/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/core/random.ts
    Description: Cryptographically secure random number primitives.
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
 * Cryptographically secure random primitives.
 *
 * Everything in the generator draws its randomness from here, and this module
 * only ever draws from `crypto.getRandomValues` (a CSPRNG seeded by the OS).
 * `Math.random` is never used.
 */

/** Fills the given typed array with random 32-bit values. */
export type RandomFill = (buffer: Uint32Array) => Uint32Array;

/** Number of distinct values a Uint32 can take (2^32). */
const UINT32_RANGE = 0x1_0000_0000;

/**
 * Default randomness source: the Web Crypto CSPRNG.
 *
 * @param buffer - Array to fill with random values.
 * @returns The same array, filled.
 */
export const cryptoFill: RandomFill = (buffer) => crypto.getRandomValues(buffer);

/**
 * Returns a uniformly distributed integer in `[0, maxExclusive)`.
 *
 * A plain `random % max` is biased whenever `max` does not divide 2^32 evenly:
 * the low residues would come up slightly more often. To avoid that, values in
 * the incomplete final "bucket" at the top of the range are rejected and
 * redrawn. The rejection probability is always below 50%, so the expected
 * number of draws is below 2.
 *
 * @param maxExclusive - Exclusive upper bound, an integer in `[1, 2^32]`.
 * @param fill - Randomness source; injectable so tests can be deterministic.
 * @returns An integer in `[0, maxExclusive)`.
 * @throws RangeError when `maxExclusive` is not an integer in `[1, 2^32]`.
 */
export function secureRandomInt(maxExclusive: number, fill: RandomFill = cryptoFill): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > UINT32_RANGE) {
        throw new RangeError(`maxExclusive must be an integer in [1, 2^32], got ${maxExclusive}`);
    }
    if (maxExclusive === 1) return 0;

    // Largest multiple of maxExclusive that fits in the Uint32 range.
    const limit = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
    const buffer = new Uint32Array(1);
    for (;;) {
        const value = fill(buffer)[0]!;
        if (value < limit) return value % maxExclusive;
    }
}

/**
 * Picks one character of a string uniformly at random.
 *
 * @param alphabet - Non-empty string of candidate characters.
 * @param fill - Randomness source; injectable so tests can be deterministic.
 * @returns One character of `alphabet`.
 * @throws RangeError when `alphabet` is empty.
 */
export function secureRandomChar(alphabet: string, fill: RandomFill = cryptoFill): string {
    if (alphabet.length === 0) throw new RangeError("alphabet must not be empty");
    return alphabet[secureRandomInt(alphabet.length, fill)]!;
}
