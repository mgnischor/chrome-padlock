/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/shared/format.ts
    Description: Language-aware formatting of crack times and guess rates for the strength test screen.
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
import type { CrackTime } from "../core/strength";

/** Options shared by every number shown on the strength test screen. */
const BASE_OPTIONS: Intl.NumberFormatOptions = {
    // Two significant digits are enough for an estimate, and Latin digits match the rest of the interface.
    maximumSignificantDigits: 2,
    numberingSystem: "latn",
};

/**
 * Builds a number formatter, falling back to English when the runtime does not know the language.
 *
 * @param tag - A BCP 47 language tag such as `pt-BR`.
 * @param options - Formatting options.
 * @returns A formatter.
 */
function numberFormat(tag: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
    try {
        return new Intl.NumberFormat(tag, options);
    } catch {
        return new Intl.NumberFormat("en", options);
    }
}

/**
 * Formats a duration such as "3 days" or "12 thousand years" in a language. The unit names and
 * plural forms come from the browser's locale data, so no unit has to be translated by hand.
 *
 * @param time - A crack time that is a duration.
 * @param tag - A BCP 47 language tag such as `pt-BR`.
 * @returns The formatted duration.
 */
export function formatDuration(time: Extract<CrackTime, { kind: "duration" }>, tag: string): string {
    const rounded = Number(time.value.toPrecision(2));
    return numberFormat(tag, {
        ...BASE_OPTIONS,
        style: "unit",
        unit: time.unit,
        unitDisplay: "long",
        notation: rounded >= 1000 ? "compact" : "standard",
        compactDisplay: "long",
    }).format(time.value);
}

/**
 * Formats a number of guesses, such as "10 billion", in a language.
 *
 * @param rate - The number of guesses.
 * @param tag - A BCP 47 language tag such as `pt-BR`.
 * @returns The formatted number, abbreviated in words from 1,000 up.
 */
export function formatRate(rate: number, tag: string): string {
    return numberFormat(tag, {
        ...BASE_OPTIONS,
        notation: rate >= 1000 ? "compact" : "standard",
        compactDisplay: "long",
    }).format(rate);
}
