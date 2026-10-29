/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/format.test.ts
    Description: Unit tests for the language-aware formatting of crack times and guess rates.
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
import type { DurationUnit } from "../src/core/strength";
import { formatDuration, formatRate } from "../src/shared/format";
import { LOCALES } from "../src/shared/locales";

/**
 * Builds a duration crack time.
 *
 * @param value - Amount of the unit.
 * @param unit - The unit.
 * @returns A crack time of kind "duration".
 */
const duration = (value: number, unit: DurationUnit) => ({ kind: "duration" as const, value, unit });

describe("formatDuration", () => {
    it("writes durations in words, with the right unit", () => {
        expect(formatDuration(duration(3, "day"), "en-US")).toBe("3 days");
        expect(formatDuration(duration(1, "hour"), "en-US")).toBe("1 hour");
        expect(formatDuration(duration(45, "second"), "en-US")).toBe("45 seconds");
        expect(formatDuration(duration(1.8, "year"), "en-US")).toBe("1.8 years");
    });

    it("keeps two significant digits", () => {
        expect(formatDuration(duration(12.345, "minute"), "en-US")).toBe("12 minutes");
        expect(formatDuration(duration(1.234, "year"), "en-US")).toBe("1.2 years");
    });

    it("spells out large numbers of years", () => {
        expect(formatDuration(duration(12_000, "year"), "en-US")).toBe("12 thousand years");
        expect(formatDuration(duration(2.4e9, "year"), "en-US")).toBe("2.4 billion years");
    });

    it("uses the unit names of the language", () => {
        expect(formatDuration(duration(3, "day"), "pt-BR")).toBe("3 dias");
        expect(formatDuration(duration(3, "day"), "es")).toBe("3 días");
        expect(formatDuration(duration(3, "day"), "de")).toBe("3 Tage");
        expect(formatDuration(duration(5, "year"), "ru")).toMatch(/5 (лет|годам)/);
    });

    it("always writes the digits as 0-9, like the rest of the interface", () => {
        for (const { tag } of LOCALES) {
            const text = formatDuration(duration(34, "day"), tag);
            expect(text, tag).toMatch(/34/);
            expect(text, tag).not.toMatch(/[٠-٩۰-۹०-९০-৯]/);
        }
    });

    it("works in every supported language", () => {
        for (const { tag } of LOCALES) {
            for (const unit of ["second", "minute", "hour", "day", "year"] as const) {
                expect(formatDuration(duration(2, unit), tag).length, `${tag} ${unit}`).toBeGreaterThan(1);
            }
        }
    });

    it("falls back to English for a tag the runtime rejects", () => {
        expect(formatDuration(duration(3, "day"), "not a valid tag!")).toBe("3 days");
    });
});

describe("formatRate", () => {
    it("writes round numbers of guesses in words from a thousand up", () => {
        expect(formatRate(10, "en-US")).toBe("10");
        expect(formatRate(100, "en-US")).toBe("100");
        expect(formatRate(10_000, "en-US")).toBe("10 thousand");
        expect(formatRate(1e10, "en-US")).toBe("10 billion");
    });

    it("follows the language", () => {
        expect(formatRate(1e10, "pt-BR")).toBe("10 bilhões");
        expect(formatRate(1e10, "de")).toBe("10 Milliarden");
    });

    it("works in every supported language", () => {
        for (const { tag } of LOCALES) {
            expect(formatRate(1e10, tag), tag).toMatch(/10/);
            expect(formatRate(100, tag), tag).toBe("100");
        }
    });
});
