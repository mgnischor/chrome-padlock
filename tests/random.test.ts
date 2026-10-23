/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/random.test.ts
    Description: Unit tests for the secure random number primitives.
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
import { secureRandomChar, secureRandomInt, type RandomFill } from "../src/core/random";

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

describe("secureRandomInt", () => {
  it("rejects invalid bounds", () => {
    expect(() => secureRandomInt(0)).toThrow(RangeError);
    expect(() => secureRandomInt(-1)).toThrow(RangeError);
    expect(() => secureRandomInt(1.5)).toThrow(RangeError);
    expect(() => secureRandomInt(2 ** 32 + 1)).toThrow(RangeError);
  });

  it("returns 0 without consuming randomness when max is 1", () => {
    const fill: RandomFill = () => {
      throw new Error("should not be called");
    };
    expect(secureRandomInt(1, fill)).toBe(0);
  });

  it("rejects values from the biased tail instead of wrapping them", () => {
    // max = 3 -> limit = 2^32 - (2^32 % 3) = 2^32 - 1, so only 0xFFFFFFFF is rejected.
    const fill = sequence(0xffffffff, 7);
    expect(secureRandomInt(3, fill)).toBe(7 % 3);
  });

  it("maps accepted values with modulo", () => {
    expect(secureRandomInt(10, sequence(1234))).toBe(4);
  });

  it("stays within range and is roughly uniform with the real CSPRNG", () => {
    const max = 7;
    const draws = 70_000;
    const counts = new Array<number>(max).fill(0);
    for (let i = 0; i < draws; i++) {
      const value = secureRandomInt(max);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(max);
      counts[value]!++;
    }
    // Chi-square with 6 degrees of freedom; 22.46 is the 0.1% critical value.
    const expected = draws / max;
    const chi2 = counts.reduce((sum, observed) => sum + (observed - expected) ** 2 / expected, 0);
    expect(chi2).toBeLessThan(22.46);
  });
});

describe("secureRandomChar", () => {
  it("picks characters from the alphabet", () => {
    expect(secureRandomChar("abc", sequence(4))).toBe("b");
  });

  it("rejects an empty alphabet", () => {
    expect(() => secureRandomChar("")).toThrow(RangeError);
  });
});
