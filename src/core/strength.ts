/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/core/strength.ts
    Description: Entropy estimate and crack-time estimate for any password, used by the strength test screen.
    Author: Miguel Nischor <miguel@nischor.com.br>

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/
import { COMMON_PASSWORDS } from "./common-passwords";

/**
 * How the strength of a password is estimated.
 *
 * The password is split into pieces, and every piece is priced in bits of "guessing effort" the way
 * an attacker would try it: a common password costs `log2(rank)`, a repeat costs the repeated unit
 * plus `log2(times)`, a sequence or keyboard run costs a starting point plus its length, a year
 * costs about seven bits, and anything else costs `log2(pool)` per character, where the pool is the
 * set of character types used. The cheapest way to split the password gives the estimate. For a
 * random password this equals `length * log2(pool)`; for a chosen one it is lower, often far lower.
 *
 * This is an estimate, not a proof: it knows only the patterns coded here and a short list of common
 * passwords, and it cannot tell whether a password has leaked.
 */

/** Passwords shorter than this get a warning. */
export const MIN_RECOMMENDED_LENGTH = 8;

/** Longest password analyzed piece by piece; any characters beyond it are priced as random. */
const MAX_ANALYZED_LENGTH = 256;

/** Pool sizes of the character types, used to price characters that match no pattern. */
const POOL_LOWERCASE = 26;
const POOL_UPPERCASE = 26;
const POOL_DIGITS = 10;
/** ASCII punctuation plus the space. */
const POOL_SYMBOLS = 33;
/** Anything else (accented letters, other scripts, emoji): a rough allowance. */
const POOL_OTHER = 100;

/** Longest sequence or keyboard run looked for; longer pieces cannot be one. */
const MAX_RUN_LENGTH = 64;

/** Bits that identify the starting point of a sequence or keyboard run. */
const RUN_START_BITS = 5;
/** Bits to pick a year between 1900 and 2039, plus one for "this is a year". */
const YEAR_BITS = Math.log2(140) + 1;

/** Keyboard rows; a run of neighbouring keys, in either direction, is a pattern. */
const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"] as const;

/** Look-alike substitutions undone before matching the common-password list. */
const LEET: Readonly<Record<string, string>> = {
    "@": "a",
    "4": "a",
    "8": "b",
    "3": "e",
    "6": "g",
    "1": "i",
    "!": "i",
    "0": "o",
    "$": "s",
    "5": "s",
    "7": "t",
    "+": "t",
    "2": "z",
};

/** Common password -> rank (1 is the most common). */
const COMMON_RANK: ReadonlyMap<string, number> = new Map(
    COMMON_PASSWORDS.map((word, index) => [word, index + 1] as const).reverse()
);

/** Longest entry of the common-password list, which bounds the pieces tried against it. */
const MAX_COMMON_LENGTH = Math.max(...COMMON_PASSWORDS.map((word) => word.length));

/** What a piece of the password was recognized as. */
type PieceKind = "random" | "common" | "repeat" | "sequence" | "keyboard" | "year";

/** A warning the strength test can raise. */
export type StrengthWarning = "common" | "pattern" | "short";

/** The result of analyzing one password. */
export interface PasswordAnalysis {
    /** Number of characters (code points). */
    length: number;
    /** Size of the character pool implied by the types of characters used. */
    poolSize: number;
    /** Estimated entropy in bits, after accounting for patterns. */
    entropyBits: number;
    /** What the estimate found worth warning about, most serious first. */
    warnings: StrengthWarning[];
}

/**
 * Computes the size of the character pool a password draws from.
 *
 * @param characters - The password's characters.
 * @returns The sum of the sizes of the character types that appear.
 */
function poolSizeOf(characters: readonly string[]): number {
    let lower = false;
    let upper = false;
    let digit = false;
    let symbol = false;
    let other = false;
    for (const ch of characters) {
        if (ch >= "a" && ch <= "z") lower = true;
        else if (ch >= "A" && ch <= "Z") upper = true;
        else if (ch >= "0" && ch <= "9") digit = true;
        else if (ch.charCodeAt(0) < 128) symbol = true;
        else other = true;
    }
    return (
        (lower ? POOL_LOWERCASE : 0) +
        (upper ? POOL_UPPERCASE : 0) +
        (digit ? POOL_DIGITS : 0) +
        (symbol ? POOL_SYMBOLS : 0) +
        (other ? POOL_OTHER : 0) ||
        1
    );
}

/**
 * Undoes common look-alike substitutions (`@` for `a`, `0` for `o`, ...) in a lowercase string.
 *
 * @param text - Lowercase text.
 * @returns The text with the substitutions reversed.
 */
function undoLeet(text: string): string {
    return [...text].map((ch) => LEET[ch] ?? ch).join("");
}

/**
 * Finds how well a piece of the password matches the common-password list.
 *
 * @param piece - A run of the password's characters.
 * @returns The price in bits, or `undefined` when the piece is not in the list.
 */
function commonCost(piece: string): number | undefined {
    const lower = piece.toLowerCase();
    const plain = COMMON_RANK.get(lower);
    const leet = COMMON_RANK.get(undoLeet(lower));
    const rank = plain ?? leet;
    if (rank === undefined) return undefined;
    // A little extra for capitals and look-alike substitutions: they widen what must be tried.
    const caseExtra = piece !== lower ? 1 : 0;
    const leetExtra = plain === undefined ? 1 : 0;
    return Math.log2(rank + 1) + caseExtra + leetExtra;
}

/**
 * Prices a run of characters that each step by one code point (`abcd`, `4321`).
 *
 * @param characters - The run.
 * @returns The price in bits, or `undefined` when it is not such a run.
 */
function sequenceCost(characters: readonly string[]): number | undefined {
    if (characters.length < 3) return undefined;
    const step = characters[1]!.codePointAt(0)! - characters[0]!.codePointAt(0)!;
    if (Math.abs(step) !== 1) return undefined;
    for (let i = 2; i < characters.length; i++) {
        if (characters[i]!.codePointAt(0)! - characters[i - 1]!.codePointAt(0)! !== step) return undefined;
    }
    if (!characters.every((ch) => /^[\p{L}\p{N}]$/u.test(ch))) return undefined;
    return RUN_START_BITS + 1 + Math.log2(characters.length);
}

/**
 * Prices a run of neighbouring keys of a keyboard row (`asdf`, `0987`).
 *
 * @param characters - The run.
 * @returns The price in bits, or `undefined` when it is not such a run.
 */
function keyboardCost(characters: readonly string[]): number | undefined {
    if (characters.length < 3) return undefined;
    const text = characters.join("").toLowerCase();
    const reversed = [...text].reverse().join("");
    const found = KEYBOARD_ROWS.some((row) => row.includes(text) || row.includes(reversed));
    return found ? RUN_START_BITS + 1 + Math.log2(characters.length) : undefined;
}

/**
 * Prices a four-digit year between 1900 and 2039.
 *
 * @param characters - The piece to test.
 * @returns The price in bits, or `undefined` when it is not such a year.
 */
function yearCost(characters: readonly string[]): number | undefined {
    if (characters.length !== 4 || !characters.every((ch) => ch >= "0" && ch <= "9")) return undefined;
    const year = Number(characters.join(""));
    return year >= 1900 && year <= 2039 ? YEAR_BITS : undefined;
}

/**
 * Prices a piece made of one shorter unit repeated at least twice (`aaaa`, `abcabc`).
 *
 * @param characters - The piece to test.
 * @param bitsPerCharacter - Price of one random character, used to price the repeated unit.
 * @returns The price in bits, or `undefined` when the piece is not a repeat.
 */
function repeatCost(characters: readonly string[], bitsPerCharacter: number): number | undefined {
    const length = characters.length;
    if (length < 3) return undefined;
    for (let unit = 1; unit <= length / 2; unit++) {
        if (length % unit !== 0) continue;
        let repeats = true;
        for (let i = unit; i < length && repeats; i++) repeats = characters[i] === characters[i - unit];
        if (repeats) return unit * bitsPerCharacter + Math.log2(length / unit) + 1;
    }
    return undefined;
}

/**
 * Estimates the entropy of a password and notes what weakens it.
 *
 * @param password - The password to analyze. It is only read; nothing is stored or sent.
 * @returns The estimate and the warnings that apply. An empty password has 0 bits.
 */
export function analyzePassword(password: string): PasswordAnalysis {
    const characters = [...password];
    const length = characters.length;
    const poolSize = poolSizeOf(characters);
    const bitsPerCharacter = Math.log2(poolSize);
    if (length === 0) return { length: 0, poolSize, entropyBits: 0, warnings: ["short"] };

    const analyzed = Math.min(length, MAX_ANALYZED_LENGTH);
    const best = new Array<number>(analyzed + 1).fill(Number.POSITIVE_INFINITY);
    const choice = new Array<{ from: number; kind: PieceKind }>(analyzed + 1);
    best[0] = 0;

    for (let end = 1; end <= analyzed; end++) {
        // A single character matching nothing is priced as a random pick from the pool.
        best[end] = best[end - 1]! + bitsPerCharacter;
        choice[end] = { from: end - 1, kind: "random" };

        for (let start = 0; start < end - 2; start++) {
            const pieceLength = end - start;
            const piece = characters.slice(start, end);
            const candidates: Array<[number | undefined, PieceKind]> = [
                [pieceLength <= MAX_COMMON_LENGTH ? commonCost(piece.join("")) : undefined, "common"],
                [repeatCost(piece, bitsPerCharacter), "repeat"],
                [pieceLength <= MAX_RUN_LENGTH ? sequenceCost(piece) : undefined, "sequence"],
                [pieceLength <= MAX_RUN_LENGTH ? keyboardCost(piece) : undefined, "keyboard"],
                [pieceLength === 4 ? yearCost(piece) : undefined, "year"],
            ];
            for (const [cost, kind] of candidates) {
                if (cost === undefined) continue;
                const total = best[start]! + cost;
                if (total < best[end]!) {
                    best[end] = total;
                    choice[end] = { from: start, kind };
                }
            }
        }
    }

    // Walk the cheapest split back to see which kinds of piece it used.
    let commonCovered = 0;
    let hasPattern = false;
    for (let end = analyzed; end > 0; ) {
        const { from, kind } = choice[end]!;
        if (kind === "common") commonCovered += end - from;
        else if (kind !== "random") hasPattern = true;
        end = from;
    }

    const warnings: StrengthWarning[] = [];
    if (commonCovered >= analyzed * 0.6) warnings.push("common");
    if (hasPattern) warnings.push("pattern");
    if (length < MIN_RECOMMENDED_LENGTH) warnings.push("short");

    return {
        length,
        poolSize,
        entropyBits: best[analyzed]! + (length - analyzed) * bitsPerCharacter,
        warnings,
    };
}

/** One way of attacking a password, with how fast the attacker can guess. */
export interface AttackScenario {
    id: "onlineSlow" | "onlineFast" | "offlineSlow" | "offlineFast";
    /** Guesses per second, used for the calculation. */
    guessesPerSecond: number;
    /** The rate as it is shown to the user, in `per` units. */
    displayRate: number;
    per: "hour" | "second";
}

/**
 * The attacks the strength test reports, from the slowest to the fastest. The rates are the widely
 * used ones of the zxcvbn estimator: a throttled web login, an unthrottled one, an offline attack on a
 * deliberately slow hash such as bcrypt, and an offline attack on a fast hash such as MD5 with GPUs.
 */
export const ATTACK_SCENARIOS: readonly AttackScenario[] = [
    { id: "onlineSlow", guessesPerSecond: 100 / 3600, displayRate: 100, per: "hour" },
    { id: "onlineFast", guessesPerSecond: 10, displayRate: 10, per: "second" },
    { id: "offlineSlow", guessesPerSecond: 1e4, displayRate: 1e4, per: "second" },
    { id: "offlineFast", guessesPerSecond: 1e10, displayRate: 1e10, per: "second" },
];

/** Units of a crack time, named as `Intl.NumberFormat` knows them. */
export type DurationUnit = "second" | "minute" | "hour" | "day" | "year";

/** How long a crack takes, ready to be shown in any language. */
export type CrackTime =
    | { kind: "instant" }
    | { kind: "duration"; value: number; unit: DurationUnit }
    | { kind: "universe" };

const SECONDS_PER_YEAR = 365.25 * 24 * 3600;
/** The universe is about 13.8 billion years old. */
const UNIVERSE_AGE_SECONDS = 13.8e9 * SECONDS_PER_YEAR;

/**
 * Estimates how long an attacker needs, on average, to guess a password.
 *
 * On average an attacker finds the password after trying half of all possibilities, that is
 * `2^(bits - 1)` guesses. The calculation is done on logarithms, so passwords of any strength
 * give an answer instead of overflowing.
 *
 * @param entropyBits - Entropy of the password in bits.
 * @param guessesPerSecond - How fast the attacker guesses.
 * @returns The time, as a value and unit, or as "instant" or "longer than the universe's age".
 */
export function crackTime(entropyBits: number, guessesPerSecond: number): CrackTime {
    const log2Seconds = entropyBits - 1 - Math.log2(guessesPerSecond);
    if (log2Seconds >= Math.log2(UNIVERSE_AGE_SECONDS)) return { kind: "universe" };
    const seconds = 2 ** log2Seconds;
    if (seconds < 1) return { kind: "instant" };
    if (seconds < 60) return { kind: "duration", value: seconds, unit: "second" };
    if (seconds < 3600) return { kind: "duration", value: seconds / 60, unit: "minute" };
    if (seconds < 86_400) return { kind: "duration", value: seconds / 3600, unit: "hour" };
    if (seconds < SECONDS_PER_YEAR) return { kind: "duration", value: seconds / 86_400, unit: "day" };
    return { kind: "duration", value: seconds / SECONDS_PER_YEAR, unit: "year" };
}
