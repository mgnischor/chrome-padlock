/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/core/passphrase.ts
    Description: Passphrase generation, option validation and entropy accounting.
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
import { GeneratorError } from "./generator";
import { cryptoFill, secureRandomInt, type RandomFill } from "./random";
import { WORDLIST } from "./wordlist";

export const MIN_WORDS = 3;
export const MAX_WORDS = 12;
export const DEFAULT_WORDS = 6;

/** What can stand between two words: a hyphen, a space, a period, an underscore or nothing. */
export const PASSPHRASE_SEPARATORS = ["-", " ", ".", "_", ""] as const;

export type PassphraseSeparator = (typeof PASSPHRASE_SEPARATORS)[number];

export interface PassphraseOptions {
    /** Number of words, from {@link MIN_WORDS} to {@link MAX_WORDS}. */
    words: number;
    separator: PassphraseSeparator;
    /** Start every word with a capital letter. */
    capitalize: boolean;
    /** Append one random digit to one random word. */
    includeNumber: boolean;
}

export const DEFAULT_PASSPHRASE_OPTIONS: Readonly<PassphraseOptions> = {
    words: DEFAULT_WORDS,
    separator: "-",
    capitalize: false,
    includeNumber: false,
};

/** Number of different digits that can be appended to a word. */
const DIGIT_COUNT = 10;

/**
 * Turns untrusted data into valid passphrase options. Unknown or malformed fields fall back to
 * their defaults, and the word count is clamped to its range.
 *
 * @param raw - Value read from storage or assembled from form controls.
 * @returns Valid passphrase options.
 */
export function sanitizePassphraseOptions(raw: unknown): PassphraseOptions {
    const isRecord = typeof raw === "object" && raw !== null && !Array.isArray(raw);
    const input = (isRecord ? raw : {}) as Record<string, unknown>;
    const defaults = DEFAULT_PASSPHRASE_OPTIONS;

    const words =
        typeof input.words === "number" && Number.isFinite(input.words)
            ? Math.min(MAX_WORDS, Math.max(MIN_WORDS, Math.round(input.words)))
            : defaults.words;

    return {
        words,
        separator: PASSPHRASE_SEPARATORS.find((choice) => choice === input.separator) ?? defaults.separator,
        capitalize: typeof input.capitalize === "boolean" ? input.capitalize : defaults.capitalize,
        includeNumber: typeof input.includeNumber === "boolean" ? input.includeNumber : defaults.includeNumber,
    };
}

/**
 * Checks the word count.
 *
 * @param options - Passphrase options.
 * @throws GeneratorError when the word count is not an integer in range.
 */
function assertValid(options: PassphraseOptions): void {
    if (!Number.isInteger(options.words) || options.words < MIN_WORDS || options.words > MAX_WORDS) {
        throw new GeneratorError("INVALID_WORD_COUNT", `Word count must be between ${MIN_WORDS} and ${MAX_WORDS}.`);
    }
}

/**
 * Computes the entropy of the random choices behind a passphrase: every word is drawn uniformly
 * and independently from the list, and the optional digit adds a uniform choice of the word it
 * goes on and of the digit. Capitalization and the separator are fixed by the options, so they
 * add nothing. With no separator, a few different choices can spell the same text; the
 * difference is negligible.
 *
 * @param options - Passphrase options.
 * @param listSize - Number of words to draw from; the built-in list by default.
 * @returns Entropy in bits, or 0 when the options cannot produce a passphrase.
 */
export function passphraseEntropyBits(options: PassphraseOptions, listSize: number = WORDLIST.length): number {
    if (!Number.isInteger(options.words) || options.words < MIN_WORDS || options.words > MAX_WORDS) return 0;
    const wordBits = options.words * Math.log2(listSize);
    return options.includeNumber ? wordBits + Math.log2(options.words * DIGIT_COUNT) : wordBits;
}

/**
 * Generates a passphrase: words picked uniformly and independently at random from a list, so
 * that the entropy is exactly {@link passphraseEntropyBits}.
 *
 * @param options - Passphrase options.
 * @param fill - Randomness source; injectable so tests can be deterministic.
 * @param list - Words to draw from; the built-in list by default.
 * @returns The passphrase, for example `abruptly-frosting-gamble-wiry-snowman-cabbage`.
 * @throws GeneratorError when the word count is out of range.
 */
export function generatePassphrase(
    options: PassphraseOptions,
    fill: RandomFill = cryptoFill,
    list: readonly string[] = WORDLIST
): string {
    assertValid(options);

    const picked: string[] = [];
    for (let i = 0; i < options.words; i++) {
        const word = list[secureRandomInt(list.length, fill)]!;
        picked.push(options.capitalize ? word.charAt(0).toUpperCase() + word.slice(1) : word);
    }
    if (options.includeNumber) {
        picked[secureRandomInt(options.words, fill)] += String(secureRandomInt(DIGIT_COUNT, fill));
    }
    return picked.join(options.separator);
}
