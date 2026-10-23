/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/entropy.test.ts
    Description: Unit tests for the entropy calculation and strength rating.
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
import { classifyStrength, countValidStrings, entropyBits, log2BigInt } from "../src/core/entropy";

/**
 * Counts, by enumerating every string, those that use every set at least once.
 *
 * @param setSizes - Number of characters in each set.
 * @param length - Length of the strings.
 * @returns The number of valid strings.
 */
function bruteForce(setSizes: number[], length: number): bigint {
  const total = setSizes.reduce((a, b) => a + b, 0);
  // Symbols 0..total-1; set membership is by contiguous ranges.
  const bounds: number[] = [];
  let acc = 0;
  for (const size of setSizes) {
    acc += size;
    bounds.push(acc);
  }
  /**
   * Finds which set a symbol belongs to.
   *
   * @param symbol - Symbol index in `[0, total)`.
   * @returns The index of the set containing the symbol.
   */
  const setOf = (symbol: number) => bounds.findIndex((bound) => symbol < bound);

  let count = 0n;
  const stringCount = total ** length;
  for (let n = 0; n < stringCount; n++) {
    const seen = new Set<number>();
    let rest = n;
    for (let i = 0; i < length; i++) {
      seen.add(setOf(rest % total));
      rest = Math.floor(rest / total);
    }
    if (seen.size === setSizes.length) count++;
  }
  return count;
}

describe("countValidStrings", () => {
  it.each([
    [[2, 1], 3],
    [[2, 2], 4],
    [[1, 1, 1], 4],
    [[3, 2, 1], 4],
    [[2, 1, 1, 1], 5],
  ])("matches brute force for set sizes %j and length %i", (sizes, length) => {
    expect(countValidStrings(sizes, length)).toBe(bruteForce(sizes, length));
  });

  it("reduces to total^length for a single set", () => {
    expect(countValidStrings([10], 6)).toBe(10n ** 6n);
  });
});

describe("log2BigInt", () => {
  it("is exact for powers of two, including huge ones", () => {
    expect(log2BigInt(1n << 10n)).toBe(10);
    expect(log2BigInt(1n << 500n)).toBeCloseTo(500, 9);
  });

  it("agrees with Math.log2 for small values", () => {
    expect(log2BigInt(1000n)).toBeCloseTo(Math.log2(1000), 12);
  });
});

describe("entropyBits", () => {
  it("is close to length * log2(pool) for long passwords", () => {
    const bits = entropyBits([26, 26, 10, 27], 20);
    expect(bits).toBeLessThanOrEqual(20 * Math.log2(89));
    // The "every class present" constraint costs well under half a bit here.
    expect(bits).toBeGreaterThan(20 * Math.log2(89) - 0.5);
  });

  it("returns 0 for impossible configurations", () => {
    expect(entropyBits([], 10)).toBe(0);
    expect(entropyBits([5, 5], 1)).toBe(0);
  });
});

describe("classifyStrength", () => {
  it.each([
    [10, 0],
    [45, 1],
    [70, 2],
    [90, 3],
    [128, 4],
  ])("rates %i bits as level %i", (bits, level) => {
    expect(classifyStrength(bits)).toBe(level);
  });
});
