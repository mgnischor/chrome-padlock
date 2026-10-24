/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/messages.test.ts
    Description: Unit tests for the validation of runtime messages between extension contexts.
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
import { isClearClipboard, isScheduleClipboardClear } from "../src/shared/messages";

const HASH = "a".repeat(64);

describe("isScheduleClipboardClear", () => {
    const valid = { type: "schedule-clipboard-clear", hash: HASH, delaySeconds: 30 };

    it("accepts a well-formed request for each delay offered in the UI", () => {
        for (const delaySeconds of [30, 60, 120]) {
            expect(isScheduleClipboardClear({ ...valid, delaySeconds })).toBe(true);
        }
    });

    it("rejects values that are not objects", () => {
        for (const value of [undefined, null, "schedule-clipboard-clear", 42, []]) {
            expect(isScheduleClipboardClear(value)).toBe(false);
        }
    });

    it("rejects a wrong type or a malformed hash", () => {
        expect(isScheduleClipboardClear({ ...valid, type: "other" })).toBe(false);
        expect(isScheduleClipboardClear({ ...valid, hash: "abc" })).toBe(false);
        expect(isScheduleClipboardClear({ ...valid, hash: "G".repeat(64) })).toBe(false);
        expect(isScheduleClipboardClear({ ...valid, hash: `${HASH}0` })).toBe(false);
        expect(isScheduleClipboardClear({ ...valid, hash: 1 })).toBe(false);
    });

    it("rejects delays that the UI does not offer", () => {
        for (const delaySeconds of [0, -30, 1, 45, 3600, Number.NaN, Number.POSITIVE_INFINITY, "30"]) {
            expect(isScheduleClipboardClear({ ...valid, delaySeconds }), String(delaySeconds)).toBe(false);
        }
    });
});

describe("isClearClipboard", () => {
    it("accepts a well-formed request", () => {
        expect(isClearClipboard({ type: "offscreen-clear-clipboard", hash: HASH })).toBe(true);
    });

    it("rejects anything else", () => {
        for (const value of [undefined, null, {}, { type: "offscreen-clear-clipboard" }, { type: "x", hash: HASH }]) {
            expect(isClearClipboard(value)).toBe(false);
        }
    });
});
