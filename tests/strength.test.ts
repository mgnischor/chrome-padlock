/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/strength.test.ts
    Description: Unit tests for the password strength estimate and the crack-time calculation.
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
import { COMMON_PASSWORDS } from "../src/core/common-passwords";
import { analyze, DEFAULT_GENERATOR_OPTIONS, generatePassword } from "../src/core/generator";
import {
    ATTACK_SCENARIOS,
    MIN_RECOMMENDED_LENGTH,
    analyzePassword,
    crackTime,
    type CrackTime,
} from "../src/core/strength";

/**
 * Converts a crack time back to seconds, so times can be compared.
 *
 * @param time - A crack time.
 * @returns Seconds, 0 for "instant" and infinity for "longer than the universe".
 */
function toSeconds(time: CrackTime): number {
    if (time.kind === "instant") return 0;
    if (time.kind === "universe") return Number.POSITIVE_INFINITY;
    const unitSeconds = { second: 1, minute: 60, hour: 3600, day: 86_400, year: 365.25 * 86_400 };
    return time.value * unitSeconds[time.unit];
}

describe("analyzePassword", () => {
    it("gives an empty password no entropy and a length warning", () => {
        expect(analyzePassword("")).toMatchObject({ length: 0, entropyBits: 0, warnings: ["short"] });
    });

    it.each(["password", "123456", "qwerty", "letmein", "iloveyou", "admin"])("rates the common password %s as trivial", (password) => {
        const result = analyzePassword(password);
        expect(result.entropyBits).toBeLessThan(15);
        expect(result.warnings).toContain("common");
    });

    it.each(["P@ssw0rd", "Passw0rd", "PASSWORD", "p4ssw0rd", "Qwerty123"])("sees through capitals and look-alike characters in %s", (password) => {
        const result = analyzePassword(password);
        expect(result.entropyBits).toBeLessThan(25);
        expect(result.warnings).toContain("common");
    });

    it("flags a common word followed by a year as both common and a pattern", () => {
        const result = analyzePassword("welcome1985");
        expect(result.entropyBits).toBeLessThan(20);
        expect(result.warnings).toEqual(expect.arrayContaining(["common", "pattern"]));
    });

    it.each([
        ["repeated characters", "aaaaaaaaaaaa"],
        ["a repeated block", "xyzxyzxyzxyz"],
        ["an ascending run", "mnopqrst"],
        ["a descending run", "98765432"],
        ["a keyboard run", "asdfghjk"],
        ["two years", "19852020"],
    ])("treats %s as a pattern far weaker than random", (_name, password) => {
        const result = analyzePassword(password);
        expect(result.warnings).toContain("pattern");
        // Random characters from the same pool would give length * log2(pool).
        expect(result.entropyBits).toBeLessThan(result.length * Math.log2(result.poolSize) * 0.7);
    });

    it("knows a whole password it has seen, even with digits after the word", () => {
        const result = analyzePassword("password123");
        expect(result.entropyBits).toBeLessThan(15);
        expect(result.warnings).toContain("common");
    });

    it("prices a name followed by a year well below the same characters at random", () => {
        const result = analyzePassword("Maria1985");
        expect(result.warnings).toContain("pattern");
        expect(result.entropyBits).toBeLessThan(45);
        expect(result.entropyBits).toBeLessThan(9 * Math.log2(62) - 10);
    });

    it("warns about short passwords but not about long ones", () => {
        expect(analyzePassword("aB3$").warnings).toContain("short");
        expect(analyzePassword("k9#Vq2!xLm7@Rt4$Zp8&").warnings).toEqual([]);
        expect(MIN_RECOMMENDED_LENGTH).toBe(8);
    });

    it("rates a long random-looking password close to length times log2(pool)", () => {
        const result = analyzePassword("k9#Vq2!xLm7@Rt4$Zp8&");
        expect(result.poolSize).toBe(95);
        expect(result.entropyBits).toBeGreaterThan(120);
        expect(result.entropyBits).toBeLessThanOrEqual(20 * Math.log2(95) + 0.001);
    });

    it("counts the character pool by the types of characters used", () => {
        expect(analyzePassword("abc").poolSize).toBe(26);
        expect(analyzePassword("aB").poolSize).toBe(52);
        expect(analyzePassword("aB3").poolSize).toBe(62);
        expect(analyzePassword("aB3!").poolSize).toBe(95);
        expect(analyzePassword("aé").poolSize).toBe(126);
    });

    it("counts characters, not UTF-16 units", () => {
        expect(analyzePassword("😀😀😀😀").length).toBe(4);
        expect(analyzePassword("пароль").length).toBe(6);
    });

    it("agrees with the generator on passwords Padlock creates", () => {
        const exact = analyze(DEFAULT_GENERATOR_OPTIONS).entropyBits;
        let total = 0;
        const runs = 150;
        for (let i = 0; i < runs; i++) {
            const result = analyzePassword(generatePassword(DEFAULT_GENERATOR_OPTIONS));
            expect(result.warnings).not.toContain("common");
            // Accidental runs can only lower the estimate a little, and the pools differ slightly.
            expect(result.entropyBits).toBeGreaterThan(95);
            expect(result.entropyBits).toBeLessThan(exact + 4);
            total += result.entropyBits;
        }
        expect(total / runs).toBeGreaterThan(exact - 6);
    });

    it("gives longer random passwords more entropy", () => {
        const short = analyzePassword("Tq8#mZ4!");
        const long = analyzePassword("Tq8#mZ4!Lw5@Xe9$");
        expect(long.entropyBits).toBeGreaterThan(short.entropyBits * 1.8);
    });

    it("stays fast and finite for very long input", () => {
        const started = Date.now();
        const result = analyzePassword("x".repeat(1000));
        expect(Number.isFinite(result.entropyBits)).toBe(true);
        expect(Date.now() - started).toBeLessThan(3000);
        expect(analyzePassword("a1".repeat(300)).warnings).toContain("pattern");
    });

    it("never reports negative entropy", () => {
        for (const password of ["a", "aa", "aaa", "12345", "zzzzzz", "ab", "1"]) {
            expect(analyzePassword(password).entropyBits).toBeGreaterThan(0);
        }
    });
});

describe("common password list", () => {
    it("has no duplicates, empty entries or upper case", () => {
        expect(new Set(COMMON_PASSWORDS).size).toBe(COMMON_PASSWORDS.length);
        for (const word of COMMON_PASSWORDS) {
            expect(word).not.toBe("");
            expect(word).toBe(word.toLowerCase());
        }
    });
});

describe("crackTime", () => {
    const fast = 1e10;

    it("says instant below one second", () => {
        expect(crackTime(0, fast)).toEqual({ kind: "instant" });
        expect(crackTime(20, fast)).toEqual({ kind: "instant" });
    });

    it("takes half of all guesses on average", () => {
        // 2^40 / 2 guesses at 1e10 per second.
        const time = crackTime(40, fast);
        expect(time.kind).toBe("duration");
        expect(toSeconds(time)).toBeCloseTo(2 ** 39 / fast, 6);
    });

    it("picks a sensible unit across the whole range", () => {
        /**
         * Finds which unit the crack time of a given number of seconds is shown in.
         *
         * @param seconds - Seconds the attack takes on average.
         * @returns The unit name, or `universe` when it takes longer than the age of the universe.
         */
        const unitAt = (seconds: number) => {
            const time = crackTime(Math.log2(seconds) + 1, 1);
            return time.kind === "duration" ? time.unit : time.kind;
        };
        expect(unitAt(30)).toBe("second");
        expect(unitAt(600)).toBe("minute");
        expect(unitAt(7200)).toBe("hour");
        expect(unitAt(86_400 * 20)).toBe("day");
        expect(unitAt(86_400 * 800)).toBe("year");
        expect(unitAt(1e20)).toBe("universe");
    });

    it("never gets shorter as entropy grows", () => {
        for (const scenario of ATTACK_SCENARIOS) {
            let previous = -1;
            for (let bits = 0; bits <= 300; bits += 3) {
                const seconds = toSeconds(crackTime(bits, scenario.guessesPerSecond));
                expect(seconds).toBeGreaterThanOrEqual(previous);
                previous = seconds;
            }
        }
    });

    it("never gets longer as the attacker gets faster", () => {
        for (const bits of [30, 50, 70, 90]) {
            const times = ATTACK_SCENARIOS.map((scenario) => toSeconds(crackTime(bits, scenario.guessesPerSecond)));
            expect([...times].sort((a, b) => b - a)).toEqual(times);
        }
    });

    it("answers for absurdly strong passwords instead of overflowing", () => {
        expect(crackTime(5000, fast)).toEqual({ kind: "universe" });
        expect(crackTime(Number.POSITIVE_INFINITY, fast)).toEqual({ kind: "universe" });
    });

    it("puts a Padlock-strength password out of reach of every attack", () => {
        for (const scenario of ATTACK_SCENARIOS) {
            expect(crackTime(129, scenario.guessesPerSecond)).toEqual({ kind: "universe" });
        }
    });

    it("breaks a common password instantly even when the attacker is throttled", () => {
        const bits = analyzePassword("password").entropyBits;
        expect(toSeconds(crackTime(bits, ATTACK_SCENARIOS[0]!.guessesPerSecond))).toBeLessThan(3600);
        expect(crackTime(bits, fast)).toEqual({ kind: "instant" });
    });
});

describe("ATTACK_SCENARIOS", () => {
    it("lists four attacks from the slowest to the fastest", () => {
        expect(ATTACK_SCENARIOS.map((scenario) => scenario.id)).toEqual([
            "onlineSlow",
            "onlineFast",
            "offlineSlow",
            "offlineFast",
        ]);
        const rates = ATTACK_SCENARIOS.map((scenario) => scenario.guessesPerSecond);
        expect([...rates].sort((a, b) => a - b)).toEqual(rates);
    });

    it("shows rates that match the rates used in the calculation", () => {
        for (const scenario of ATTACK_SCENARIOS) {
            const perSecond = scenario.per === "hour" ? scenario.displayRate / 3600 : scenario.displayRate;
            expect(scenario.guessesPerSecond).toBeCloseTo(perSecond, 10);
        }
    });
});
