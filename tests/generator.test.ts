/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/generator.test.ts
    Description: Unit tests for password generation and option analysis.
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
import { AMBIGUOUS_CHARS, CHARSETS } from "../src/core/charsets";
import {
  analyze,
  DEFAULT_GENERATOR_OPTIONS,
  generatePassword,
  GeneratorError,
  MAX_LENGTH,
  resolveCharsets,
  type GeneratorOptions,
} from "../src/core/generator";

/**
 * Builds generator options from the defaults.
 *
 * @param overrides - Fields to change.
 * @returns Complete generator options.
 */
const opts = (overrides: Partial<GeneratorOptions> = {}): GeneratorOptions => ({
  ...DEFAULT_GENERATOR_OPTIONS,
  ...overrides,
});

/**
 * Checks whether a password uses at least one character of an alphabet.
 *
 * @param password - Password to inspect.
 * @param alphabet - Characters to look for.
 * @returns `true` when any character of `password` is in `alphabet`.
 */
const contains = (password: string, alphabet: string) => [...password].some((ch) => alphabet.includes(ch));

describe("generatePassword", () => {
  it("honours the requested length", () => {
    for (const length of [4, 8, 20, MAX_LENGTH]) {
      expect(generatePassword(opts({ length }))).toHaveLength(length);
    }
  });

  it("uses every selected class in every password, even at the minimum length", () => {
    for (let i = 0; i < 300; i++) {
      const password = generatePassword(opts({ length: 4 }));
      expect(contains(password, CHARSETS.lowercase)).toBe(true);
      expect(contains(password, CHARSETS.uppercase)).toBe(true);
      expect(contains(password, CHARSETS.digits)).toBe(true);
      expect(contains(password, CHARSETS.symbols)).toBe(true);
    }
  });

  it("never emits characters from disabled classes", () => {
    const password = generatePassword(opts({ length: 64, symbols: false, digits: false, uppercase: false }));
    expect(password).toMatch(/^[a-z]+$/);
  });

  it("never emits ambiguous characters when excluded", () => {
    for (let i = 0; i < 100; i++) {
      const password = generatePassword(opts({ length: 64, excludeAmbiguous: true }));
      for (const ch of AMBIGUOUS_CHARS) expect(password).not.toContain(ch);
    }
  });

  it("never emits user-excluded characters", () => {
    const password = generatePassword(opts({ length: 128, excludeChars: "aeiouAEIOU!@#" }));
    expect(password).not.toMatch(/[aeiouAEIOU!@#]/);
  });

  it("drops a class that is fully excluded instead of failing", () => {
    const password = generatePassword(opts({ length: 32, digits: true, excludeChars: CHARSETS.digits }));
    expect(password).not.toMatch(/[0-9]/);
  });

  it("produces different passwords on every call", () => {
    const seen = new Set(Array.from({ length: 200 }, () => generatePassword(opts())));
    expect(seen.size).toBe(200);
  });

  it("draws all positions uniformly from the pool (no positional bias)", () => {
    const options = opts({ length: 8, lowercase: false, uppercase: false, symbols: false });
    const draws = 20_000;
    const firstDigit = new Array<number>(10).fill(0);
    for (let i = 0; i < draws; i++) firstDigit[Number(generatePassword(options)[0])]!++;
    const expected = draws / 10;
    const chi2 = firstDigit.reduce((sum, observed) => sum + (observed - expected) ** 2 / expected, 0);
    // 9 degrees of freedom, 0.1% critical value.
    expect(chi2).toBeLessThan(27.88);
  });

  it("reports typed errors for invalid input", () => {
    /**
     * Runs a function and reports the code of the generator error it throws.
     *
     * @param fn - Function expected to throw a `GeneratorError`.
     * @returns The error code, or `undefined` when nothing was thrown.
     */
    const code = (fn: () => unknown) => {
      try {
        fn();
      } catch (error) {
        return (error as GeneratorError).code;
      }
      return undefined;
    };
    expect(code(() => generatePassword(opts({ length: 3 })))).toBe("INVALID_LENGTH");
    expect(code(() => generatePassword(opts({ length: MAX_LENGTH + 1 })))).toBe("INVALID_LENGTH");
    expect(code(() => generatePassword(opts({ length: 10.5 })))).toBe("INVALID_LENGTH");
    expect(
      code(() => generatePassword(opts({ lowercase: false, uppercase: false, digits: false, symbols: false }))),
    ).toBe("NO_CHARSET");
  });
});

describe("resolveCharsets / analyze", () => {
  it("returns disjoint alphabets in a stable order", () => {
    const sets = resolveCharsets(opts());
    expect(sets).toEqual([CHARSETS.lowercase, CHARSETS.uppercase, CHARSETS.digits, CHARSETS.symbols]);
  });

  it("computes pool size and entropy", () => {
    const analysis = analyze(opts({ length: 16, symbols: false }));
    expect(analysis.poolSize).toBe(62);
    expect(analysis.entropyBits).toBeLessThanOrEqual(16 * Math.log2(62));
    expect(analysis.entropyBits).toBeGreaterThan(16 * Math.log2(62) - 0.5);
  });

  it("reports zero entropy when nothing can be generated", () => {
    const analysis = analyze(opts({ lowercase: false, uppercase: false, digits: false, symbols: false }));
    expect(analysis).toEqual({ charsets: [], poolSize: 0, entropyBits: 0 });
  });
});
