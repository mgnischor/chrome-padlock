/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/secret.test.ts
    Description: Unit tests for choosing between password and passphrase generation.
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
import { GeneratorError, analyze } from "../src/core/generator";
import { passphraseEntropyBits } from "../src/core/passphrase";
import { GENERATOR_MODES, generateSecret, secretEntropyBits } from "../src/core/secret";
import { WORDLIST } from "../src/core/wordlist";
import { DEFAULT_SETTINGS, type Settings } from "../src/shared/settings";

/**
 * Builds settings for a mode, starting from the defaults.
 *
 * @param overrides - Settings to change.
 * @returns Complete settings.
 */
function settings(overrides: Partial<Settings> = {}): Settings {
    return { ...DEFAULT_SETTINGS, ...overrides };
}

describe("generateSecret", () => {
    it("lists the two modes, password first", () => {
        expect([...GENERATOR_MODES]).toEqual(["password", "passphrase"]);
        expect(DEFAULT_SETTINGS.mode).toBe("password");
    });

    it("makes a password of the requested length in password mode", () => {
        const secret = generateSecret(settings({ length: 24 }));
        expect(secret).toHaveLength(24);
    });

    it("makes words from the list in passphrase mode", () => {
        const passphrase = { ...DEFAULT_SETTINGS.passphrase, separator: " " as const };
        const words = generateSecret(settings({ mode: "passphrase", passphrase })).split(" ");
        expect(words).toHaveLength(DEFAULT_SETTINGS.passphrase.words);
        for (const word of words) expect(WORDLIST).toContain(word);
    });

    it("reports the errors of the active mode only", () => {
        // Invalid password options do not matter in passphrase mode, and the other way round.
        const noCharacters = { lowercase: false, uppercase: false, digits: false, symbols: false };
        expect(() => generateSecret(settings(noCharacters))).toThrow(GeneratorError);
        expect(() => generateSecret(settings({ ...noCharacters, mode: "passphrase" }))).not.toThrow();
        const badWords = { ...DEFAULT_SETTINGS.passphrase, words: 1 };
        expect(() => generateSecret(settings({ mode: "passphrase", passphrase: badWords }))).toThrow(GeneratorError);
        expect(() => generateSecret(settings({ passphrase: badWords }))).not.toThrow();
    });
});

describe("secretEntropyBits", () => {
    it("is the entropy of the password options in password mode", () => {
        expect(secretEntropyBits(settings())).toBe(analyze(DEFAULT_SETTINGS).entropyBits);
    });

    it("is the entropy of the passphrase options in passphrase mode", () => {
        const options = settings({ mode: "passphrase" });
        expect(secretEntropyBits(options)).toBe(passphraseEntropyBits(DEFAULT_SETTINGS.passphrase));
    });

    it("is 0 when the active mode cannot produce a result", () => {
        expect(secretEntropyBits(settings({ lowercase: false, uppercase: false, digits: false, symbols: false }))).toBe(0);
        const badWords = { ...DEFAULT_SETTINGS.passphrase, words: 99 };
        expect(secretEntropyBits(settings({ mode: "passphrase", passphrase: badWords }))).toBe(0);
    });
});
