/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/settings.test.ts
    Description: Unit tests for settings validation.
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
import { MAX_LENGTH, MIN_LENGTH } from "../src/core/generator";
import { DEFAULT_SETTINGS, MAX_EXCLUDE_CHARS, sanitizeSettings } from "../src/shared/settings";

describe("sanitizeSettings", () => {
  it("returns defaults for non-object input", () => {
    for (const raw of [undefined, null, "x", 42, []]) {
      expect(sanitizeSettings(raw)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it("keeps valid values", () => {
    const valid = {
      length: 33,
      lowercase: true,
      uppercase: false,
      digits: true,
      symbols: false,
      excludeAmbiguous: true,
      excludeChars: "xyz",
      clipboardClearSeconds: 60,
      keepHistory: true,
    };
    expect(sanitizeSettings(valid)).toEqual(valid);
  });

  it("clamps and rounds the length", () => {
    expect(sanitizeSettings({ length: 1 }).length).toBe(MIN_LENGTH);
    expect(sanitizeSettings({ length: 10_000 }).length).toBe(MAX_LENGTH);
    expect(sanitizeSettings({ length: 12.6 }).length).toBe(13);
    expect(sanitizeSettings({ length: Number.NaN }).length).toBe(DEFAULT_SETTINGS.length);
    expect(sanitizeSettings({ length: "20" }).length).toBe(DEFAULT_SETTINGS.length);
  });

  it("rejects wrongly typed flags and unknown clipboard delays", () => {
    const result = sanitizeSettings({ symbols: "yes", clipboardClearSeconds: 7, keepHistory: "true" });
    expect(result.symbols).toBe(DEFAULT_SETTINGS.symbols);
    expect(result.keepHistory).toBe(false);
    expect(result.clipboardClearSeconds).toBe(0);
  });

  it("truncates an oversized exclusion list", () => {
    expect(sanitizeSettings({ excludeChars: "a".repeat(500) }).excludeChars).toHaveLength(MAX_EXCLUDE_CHARS);
  });
});
