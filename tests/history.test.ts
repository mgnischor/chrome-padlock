/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/history.test.ts
    Description: Unit tests for the password history list handling.
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
import { MAX_LENGTH } from "../src/core/generator";
import { HISTORY_LIMIT, pushEntry, sanitizeHistory, type HistoryEntry } from "../src/shared/history";

/**
 * Builds a history entry.
 *
 * @param password - Password of the entry.
 * @param createdAt - Creation time in Unix milliseconds.
 * @returns The entry.
 */
const entry = (password: string, createdAt = 1): HistoryEntry => ({ password, createdAt });

describe("pushEntry", () => {
  it("puts the newest password first", () => {
    const result = pushEntry([entry("old", 1)], "new", 2);
    expect(result).toEqual([entry("new", 2), entry("old", 1)]);
  });

  it("does not mutate its input", () => {
    const input = [entry("a")];
    pushEntry(input, "b", 2);
    expect(input).toEqual([entry("a")]);
  });

  it("ignores a repeat of the newest password", () => {
    const input = [entry("a", 1)];
    expect(pushEntry(input, "a", 2)).toEqual([entry("a", 1)]);
  });

  it("keeps at most HISTORY_LIMIT entries, dropping the oldest", () => {
    let entries: HistoryEntry[] = [];
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) entries = pushEntry(entries, `pw${i}`, i);
    expect(entries).toHaveLength(HISTORY_LIMIT);
    expect(entries[0]!.password).toBe(`pw${HISTORY_LIMIT + 9}`);
    expect(entries.at(-1)!.password).toBe("pw10");
  });
});

describe("sanitizeHistory", () => {
  it("returns an empty list for non-array input", () => {
    for (const raw of [undefined, null, "x", 1, {}]) expect(sanitizeHistory(raw)).toEqual([]);
  });

  it("drops malformed entries and keeps valid ones", () => {
    const raw = [
      entry("good", 5),
      null,
      "text",
      { password: 1, createdAt: 1 },
      { password: "", createdAt: 1 },
      { password: "x".repeat(MAX_LENGTH + 1), createdAt: 1 },
      { password: "no-time" },
      { password: "bad-time", createdAt: Number.NaN },
    ];
    expect(sanitizeHistory(raw)).toEqual([entry("good", 5)]);
  });

  it("truncates an oversized list", () => {
    const raw = Array.from({ length: HISTORY_LIMIT + 20 }, (_, i) => entry(`pw${i}`, i));
    expect(sanitizeHistory(raw)).toHaveLength(HISTORY_LIMIT);
  });
});
