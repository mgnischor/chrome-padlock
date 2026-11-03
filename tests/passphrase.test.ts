/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/passphrase.test.ts
    Description: Unit tests for passphrase generation, its options and the word list.
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
import { describe, expect, it } from "vitest";
import { GeneratorError } from "../src/core/generator";
import {
    DEFAULT_PASSPHRASE_OPTIONS,
    MAX_WORDS,
    MIN_WORDS,
    PASSPHRASE_SEPARATORS,
    generatePassphrase,
    passphraseEntropyBits,
    sanitizePassphraseOptions,
    type PassphraseOptions,
} from "../src/core/passphrase";
import type { RandomFill } from "../src/core/random";
import { WORDLIST } from "../src/core/wordlist";

const LIST = ["alpha", "beta", "gamma"] as const;

/**
 * Builds a deterministic randomness source that replays the given values in a loop.
 *
 * @param values - 32-bit values to hand out, in order.
 * @returns A source usable in place of the CSPRNG.
 */
function sequence(...values: number[]): RandomFill {
    let index = 0;
    return (buffer) => {
        buffer[0] = values[index++ % values.length]!;
        return buffer;
    };
}

/**
 * Builds passphrase options, starting from the defaults.
 *
 * @param overrides - Options to change.
 * @returns Complete options.
 */
function options(overrides: Partial<PassphraseOptions> = {}): PassphraseOptions {
    return { ...DEFAULT_PASSPHRASE_OPTIONS, ...overrides };
}

describe("word list", () => {
    it("has 7,776 distinct words, one per roll of five dice", () => {
        expect(WORDLIST).toHaveLength(7776);
        expect(new Set(WORDLIST).size).toBe(7776);
    });

    it("only has short lower case words, without spaces or digits", () => {
        for (const word of WORDLIST) {
            expect(word, word).toMatch(/^[a-z]+(-[a-z]+)*$/);
            expect(word.length, word).toBeGreaterThanOrEqual(3);
            expect(word.length, word).toBeLessThanOrEqual(9);
        }
    });

    it("is sorted the way the original list is", () => {
        expect(WORDLIST[0]).toBe("abacus");
        expect(WORDLIST[WORDLIST.length - 1]).toBe("zoom");
    });
});

describe("sanitizePassphraseOptions", () => {
    it("returns defaults for non-object input", () => {
        for (const raw of [undefined, null, "x", 42, []]) {
            expect(sanitizePassphraseOptions(raw)).toEqual(DEFAULT_PASSPHRASE_OPTIONS);
        }
    });

    it("keeps valid values", () => {
        const valid = { words: 9, separator: ".", capitalize: true, includeNumber: true };
        expect(sanitizePassphraseOptions(valid)).toEqual(valid);
    });

    it("clamps and rounds the word count", () => {
        expect(sanitizePassphraseOptions({ words: 1 }).words).toBe(MIN_WORDS);
        expect(sanitizePassphraseOptions({ words: 500 }).words).toBe(MAX_WORDS);
        expect(sanitizePassphraseOptions({ words: 5.6 }).words).toBe(6);
        expect(sanitizePassphraseOptions({ words: Number.NaN }).words).toBe(DEFAULT_PASSPHRASE_OPTIONS.words);
        expect(sanitizePassphraseOptions({ words: "7" }).words).toBe(DEFAULT_PASSPHRASE_OPTIONS.words);
    });

    it("accepts every separator and rejects anything else", () => {
        for (const separator of PASSPHRASE_SEPARATORS) {
            expect(sanitizePassphraseOptions({ separator }).separator).toBe(separator);
        }
        for (const separator of ["--", "x", 1, null, undefined]) {
            expect(sanitizePassphraseOptions({ separator }).separator, String(separator)).toBe("-");
        }
    });

    it("rejects wrongly typed flags", () => {
        expect(sanitizePassphraseOptions({ capitalize: "yes", includeNumber: 1 })).toMatchObject({
            capitalize: false,
            includeNumber: false,
        });
    });
});

describe("passphraseEntropyBits", () => {
    it("gives every word log2 of the list size", () => {
        expect(passphraseEntropyBits(options({ words: 1 + MIN_WORDS }))).toBeCloseTo(4 * Math.log2(7776), 10);
        expect(passphraseEntropyBits(options())).toBeCloseTo(77.55, 2);
    });

    it("uses the size of the list it is given", () => {
        expect(passphraseEntropyBits(options({ words: 4 }), 1024)).toBeCloseTo(40, 10);
    });

    it("adds the choice of the word and of the digit for a number", () => {
        const plain = passphraseEntropyBits(options({ words: 5 }));
        const numbered = passphraseEntropyBits(options({ words: 5, includeNumber: true }));
        expect(numbered - plain).toBeCloseTo(Math.log2(50), 10);
    });

    it("adds nothing for capitalization or the separator", () => {
        const plain = passphraseEntropyBits(options());
        expect(passphraseEntropyBits(options({ capitalize: true, separator: "" }))).toBe(plain);
    });

    it("grows with the number of words", () => {
        let previous = 0;
        for (let words = MIN_WORDS; words <= MAX_WORDS; words++) {
            const bits = passphraseEntropyBits(options({ words }));
            expect(bits).toBeGreaterThan(previous);
            previous = bits;
        }
    });

    it("is 0 when the word count is out of range", () => {
        expect(passphraseEntropyBits(options({ words: 2 }))).toBe(0);
        expect(passphraseEntropyBits(options({ words: MAX_WORDS + 1 }))).toBe(0);
        expect(passphraseEntropyBits(options({ words: 4.5 }))).toBe(0);
    });
});

describe("generatePassphrase", () => {
    it("joins the drawn words with the separator", () => {
        expect(generatePassphrase(options({ words: 3 }), sequence(0, 1, 2), LIST)).toBe("alpha-beta-gamma");
        expect(generatePassphrase(options({ words: 3, separator: " " }), sequence(2, 2, 0), LIST)).toBe(
            "gamma gamma alpha"
        );
        expect(generatePassphrase(options({ words: 3, separator: "" }), sequence(0, 1, 2), LIST)).toBe("alphabetagamma");
    });

    it("starts every word with a capital letter when asked to", () => {
        expect(generatePassphrase(options({ words: 3, capitalize: true }), sequence(0, 1, 2), LIST)).toBe(
            "Alpha-Beta-Gamma"
        );
        expect(generatePassphrase(options({ words: 3, capitalize: true }), sequence(0, 0, 0), ["yo-yo"])).toBe(
            "Yo-yo-Yo-yo-Yo-yo"
        );
    });

    it("puts one digit at the end of one word when asked to", () => {
        // Three words, then the word that gets the digit (index 1), then the digit (7).
        const fill = sequence(0, 1, 2, 1, 7);
        expect(generatePassphrase(options({ words: 3, includeNumber: true }), fill, LIST)).toBe("alpha-beta7-gamma");
    });

    it("can put the digit on the first and on the last word", () => {
        expect(generatePassphrase(options({ words: 3, includeNumber: true }), sequence(0, 1, 2, 0, 3), LIST)).toBe(
            "alpha3-beta-gamma"
        );
        expect(generatePassphrase(options({ words: 3, includeNumber: true }), sequence(0, 1, 2, 2, 0), LIST)).toBe(
            "alpha-beta-gamma0"
        );
    });

    it("uses exactly the requested number of words", () => {
        for (let words = MIN_WORDS; words <= MAX_WORDS; words++) {
            const passphrase = generatePassphrase(options({ words, separator: " " }));
            expect(passphrase.split(" ")).toHaveLength(words);
        }
    });

    it("draws from the built-in list with the real CSPRNG", () => {
        const known = new Set(WORDLIST);
        for (let i = 0; i < 200; i++) {
            const words = generatePassphrase(options({ words: 8, separator: " " })).split(" ");
            for (const word of words) expect(known.has(word), word).toBe(true);
        }
    });

    it("does not repeat itself", () => {
        const seen = new Set(Array.from({ length: 50 }, () => generatePassphrase(options())));
        expect(seen.size).toBe(50);
    });

    it("has no digit unless asked, and exactly one when asked", () => {
        for (let i = 0; i < 100; i++) {
            expect(generatePassphrase(options())).not.toMatch(/\d/);
            expect(generatePassphrase(options({ includeNumber: true })).match(/\d/g)).toHaveLength(1);
        }
    });

    it("picks every word of the list about equally often", () => {
        const list = ["a", "b", "c", "d", "e"];
        const counts = new Map<string, number>(list.map((word) => [word, 0]));
        const draws = 50_000;
        for (let i = 0; i < draws; i++) {
            const word = generatePassphrase(options({ words: 3 }), undefined, list).split("-")[0]!;
            counts.set(word, counts.get(word)! + 1);
        }
        // Chi-square with 4 degrees of freedom; 18.47 is the 0.1% critical value.
        const expected = draws / list.length;
        const chi2 = [...counts.values()].reduce((sum, observed) => sum + (observed - expected) ** 2 / expected, 0);
        expect(chi2).toBeLessThan(18.47);
    });

    it("rejects a word count out of range", () => {
        for (const words of [0, 2, MAX_WORDS + 1, 4.5, Number.NaN]) {
            expect(() => generatePassphrase(options({ words })), String(words)).toThrow(GeneratorError);
            try {
                generatePassphrase(options({ words }));
            } catch (error) {
                expect((error as GeneratorError).code).toBe("INVALID_WORD_COUNT");
            }
        }
    });
});
