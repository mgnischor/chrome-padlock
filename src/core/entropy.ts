/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/core/entropy.ts
    Description: Exact entropy calculation and strength rating for generated passwords.
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
/**
 * Exact entropy accounting for passwords produced by `generatePassword`.
 *
 * The generator samples uniformly from all strings of a given length that
 * contain at least one character of every selected class. The entropy is
 * therefore log2 of the number of such strings. It is computed with
 * inclusion-exclusion over the classes, using BigInt so that 128-character
 * passwords do not lose precision.
 */

/**
 * Counts the strings of a given length, over the union of disjoint character
 * sets, that use every set at least once.
 *
 * @param setSizes - Number of characters in each set.
 * @param length - Length of the strings.
 * @returns The exact number of valid strings.
 */
export function countValidStrings(setSizes: readonly number[], length: number): bigint {
    const total = setSizes.reduce((sum, size) => sum + size, 0);
    const subsetCount = 1 << setSizes.length;
    let count = 0n;

    // Inclusion-exclusion: strings that avoid every set in `mask` have
    // (total - sizeOf(mask))^length members; alternate signs by subset size.
    for (let mask = 0; mask < subsetCount; mask++) {
        let avoided = 0;
        let bits = 0;
        for (let i = 0; i < setSizes.length; i++) {
            if (mask & (1 << i)) {
                avoided += setSizes[i]!;
                bits++;
            }
        }
        const term = BigInt(total - avoided) ** BigInt(length);
        count += bits % 2 === 0 ? term : -term;
    }
    return count;
}

/**
 * Computes the base 2 logarithm of a BigInt, accurate to double precision even
 * for values far beyond the range of a `number`.
 *
 * @param value - The value to take the logarithm of.
 * @returns `log2(value)`, or 0 when `value` is not positive.
 */
export function log2BigInt(value: bigint): number {
    if (value <= 0n) return 0;
    const bitLength = value.toString(2).length;
    if (bitLength <= 53) return Math.log2(Number(value));
    const shift = bitLength - 53;
    return Math.log2(Number(value >> BigInt(shift))) + shift;
}

/**
 * Computes the entropy of a password drawn uniformly from the valid strings.
 *
 * @param setSizes - Number of characters in each selected set.
 * @param length - Password length.
 * @returns Entropy in bits, or 0 when no password can satisfy the constraints.
 */
export function entropyBits(setSizes: readonly number[], length: number): number {
    if (setSizes.length === 0 || length < setSizes.length) return 0;
    return log2BigInt(countValidStrings(setSizes, length));
}

/** Strength rating from 0 (very weak) to 4 (very strong). Display text is localized by the UI. */
export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

const STRENGTH_STEPS: ReadonlyArray<{ below: number; level: StrengthLevel }> = [
    { below: 40, level: 0 },
    { below: 60, level: 1 },
    { below: 80, level: 2 },
    { below: 100, level: 3 },
];

/**
 * Maps an entropy value to a strength rating.
 *
 * @param bits - Entropy in bits.
 * @returns The strength level, from 0 (very weak) to 4 (very strong).
 */
export function classifyStrength(bits: number): StrengthLevel {
    for (const step of STRENGTH_STEPS) {
        if (bits < step.below) return step.level;
    }
    return 4;
}
