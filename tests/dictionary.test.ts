/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/dictionary.test.ts
    Description: Unit tests for the word lists the strength test looks passwords up in.
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
import { MAX_DICTIONARY_LENGTH, lookupDictionary } from "../src/core/dictionary";
import { WORDLIST } from "../src/core/wordlist";

describe("lookupDictionary", () => {
    it("knows the most common leaked passwords and prices them in a few bits", () => {
        for (const password of ["password", "123456", "qwerty", "letmein", "dragon"]) {
            const match = lookupDictionary(password);
            expect(match?.kind, password).toBe("password");
            expect(match!.bits, password).toBeLessThan(10);
        }
    });

    it("prices the first entry of a list at 1 bit, and entries further down at more", () => {
        const top = lookupDictionary("123456")!;
        const lower = lookupDictionary("baseball")!;
        expect(top.bits).toBeCloseTo(1, 5);
        expect(lower.bits).toBeGreaterThan(top.bits);
    });

    it("knows ordinary English words that are no password", () => {
        const match = lookupDictionary("xylophone");
        expect(match?.kind).toBe("word");
        expect(match!.bits).toBeGreaterThan(10);
        expect(match!.bits).toBeLessThan(18);
    });

    it("prices a passphrase word at no more than log2 of the list size", () => {
        for (const word of WORDLIST.slice(0, 500)) {
            const match = lookupDictionary(word);
            expect(match, word).toBeDefined();
            expect(match!.bits, word).toBeLessThanOrEqual(Math.log2(WORDLIST.length) + 1e-9);
        }
    });

    it("answers nothing for text that is on no list", () => {
        expect(lookupDictionary("zqxjkvwpfgh")).toBeUndefined();
        expect(lookupDictionary("")).toBeUndefined();
    });

    it("matches lower case only, leaving case to the caller", () => {
        expect(lookupDictionary("password")).toBeDefined();
        expect(lookupDictionary("PASSWORD")).toBeUndefined();
    });

    it("never prices a word at less than one bit", () => {
        for (const word of ["password", "123456", "the", "you"]) {
            const match = lookupDictionary(word);
            if (match) expect(match.bits, word).toBeGreaterThanOrEqual(1);
        }
    });

    it("does not look up entries longer than the limit", () => {
        expect(lookupDictionary("a".repeat(MAX_DICTIONARY_LENGTH + 1))).toBeUndefined();
    });
});
