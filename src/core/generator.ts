/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/core/generator.ts
    Description: Password generation, option validation and entropy analysis.
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
import { AMBIGUOUS_CHARS, CHARSETS, CHARSET_IDS, type CharsetId } from "./charsets";
import { entropyBits } from "./entropy";
import { cryptoFill, secureRandomChar, type RandomFill } from "./random";

export const MIN_LENGTH = 4;
export const MAX_LENGTH = 128;
export const DEFAULT_LENGTH = 20;

/** Safety valve for the rejection loop; never reached with sane inputs. */
const MAX_ATTEMPTS = 100_000;

export interface GeneratorOptions {
    length: number;
    lowercase: boolean;
    uppercase: boolean;
    digits: boolean;
    symbols: boolean;
    /** Drop characters that look alike (0 O 1 l I |). */
    excludeAmbiguous: boolean;
    /** Extra characters the user never wants to see. */
    excludeChars: string;
}

export const DEFAULT_GENERATOR_OPTIONS: Readonly<GeneratorOptions> = {
    length: DEFAULT_LENGTH,
    lowercase: true,
    uppercase: true,
    digits: true,
    symbols: true,
    excludeAmbiguous: false,
    excludeChars: "",
};

export type GeneratorErrorCode = "INVALID_LENGTH" | "NO_CHARSET" | "LENGTH_TOO_SHORT";

/** Error thrown when the generator options cannot produce a password. */
export class GeneratorError extends Error {
    /**
     * @param code - Machine-readable reason, used by the UI to pick a localized message.
     * @param message - English description, meant for logs and debugging.
     */
    constructor(
        readonly code: GeneratorErrorCode,
        message: string
    ) {
        super(message);
        this.name = "GeneratorError";
    }
}

/** What a set of options boils down to once exclusions are applied. */
export interface Analysis {
    /** The effective, non-empty, mutually disjoint alphabets. */
    charsets: string[];
    /** Total number of distinct characters available. */
    poolSize: number;
    /** Exact entropy in bits, or 0 when the options cannot produce a password. */
    entropyBits: number;
}

/**
 * Applies the exclusion rules and returns the alphabets that remain.
 * Classes that end up empty are dropped.
 *
 * @param options - Generator options.
 * @returns The non-empty alphabets of the enabled character classes.
 */
export function resolveCharsets(options: GeneratorOptions): string[] {
    const excluded = new Set<string>(options.excludeChars);
    if (options.excludeAmbiguous) {
        for (const ch of AMBIGUOUS_CHARS) excluded.add(ch);
    }

    const enabled: Record<CharsetId, boolean> = {
        lowercase: options.lowercase,
        uppercase: options.uppercase,
        digits: options.digits,
        symbols: options.symbols,
    };

    const result: string[] = [];
    for (const id of CHARSET_IDS) {
        if (!enabled[id]) continue;
        const alphabet = [...CHARSETS[id]].filter((ch) => !excluded.has(ch)).join("");
        if (alphabet.length > 0) result.push(alphabet);
    }
    return result;
}

/**
 * Checks that the options can produce a password.
 *
 * @param options - Generator options.
 * @param charsets - Alphabets resolved from `options`.
 * @throws GeneratorError when the length is out of range, no character class is
 * available, or the length is shorter than the number of classes.
 */
function assertValid(options: GeneratorOptions, charsets: readonly string[]): void {
    if (!Number.isInteger(options.length) || options.length < MIN_LENGTH || options.length > MAX_LENGTH) {
        throw new GeneratorError("INVALID_LENGTH", `Length must be between ${MIN_LENGTH} and ${MAX_LENGTH}.`);
    }
    if (charsets.length === 0) {
        throw new GeneratorError("NO_CHARSET", "Select at least one character type.");
    }
    if (options.length < charsets.length) {
        throw new GeneratorError("LENGTH_TOO_SHORT", "Length is shorter than the number of selected character types.");
    }
}

/**
 * Describes the pool and entropy for the given options without generating anything.
 *
 * @param options - Generator options.
 * @returns The effective alphabets, pool size and exact entropy.
 */
export function analyze(options: GeneratorOptions): Analysis {
    const charsets = resolveCharsets(options);
    const poolSize = charsets.reduce((sum, set) => sum + set.length, 0);
    const valid = charsets.length > 0 && options.length >= charsets.length;
    return {
        charsets,
        poolSize,
        entropyBits: valid
            ? entropyBits(
                  charsets.map((set) => set.length),
                  options.length
              )
            : 0,
    };
}

/**
 * Generates a password that is uniformly distributed over all strings of the
 * requested length that contain at least one character from every selected
 * class.
 *
 * Uniformity is obtained by rejection sampling: draw every position
 * independently and uniformly from the combined pool, and retry the whole
 * password if some class is missing. Unlike the common "insert one character
 * of each class, then shuffle" approach this introduces no positional or
 * distributional bias, which also makes the entropy exactly computable.
 *
 * @param options - Generator options.
 * @param fill - Randomness source; injectable so tests can be deterministic.
 * @returns The generated password.
 * @throws GeneratorError when the options cannot produce a password.
 */
export function generatePassword(options: GeneratorOptions, fill: RandomFill = cryptoFill): string {
    const charsets = resolveCharsets(options);
    assertValid(options, charsets);

    const pool = charsets.join("");
    const classOf = new Map<string, number>();
    charsets.forEach((set, index) => {
        for (const ch of set) classOf.set(ch, index);
    });

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const seen = new Set<number>();
        let password = "";
        for (let i = 0; i < options.length; i++) {
            const ch = secureRandomChar(pool, fill);
            seen.add(classOf.get(ch)!);
            password += ch;
        }
        if (seen.size === charsets.length) return password;
    }
    throw new Error("Could not generate a password that satisfies the constraints.");
}
