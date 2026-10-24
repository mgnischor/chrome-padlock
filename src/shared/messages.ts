/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/shared/messages.ts
    Description: Message types and constants exchanged between the extension contexts.
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
import { CLIPBOARD_CLEAR_CHOICES } from "./settings";

/** Messages exchanged between the popup, the service worker and the offscreen document. */

/** Popup -> service worker: arm the "clear clipboard" timer for a freshly copied password. */
export interface ScheduleClipboardClearMessage {
    type: "schedule-clipboard-clear";
    /** SHA-256 (hex) of the copied password. The password itself never leaves the popup. */
    hash: string;
    delaySeconds: number;
}

/** Service worker -> offscreen document: clear the clipboard if it still holds the password. */
export interface ClearClipboardMessage {
    type: "offscreen-clear-clipboard";
    hash: string;
}

export type ExtensionMessage = ScheduleClipboardClearMessage | ClearClipboardMessage;

export const CLIPBOARD_CLEAR_ALARM = "clipboard-clear";

/** Key in `chrome.storage.session` (memory only) holding the hash awaiting clearing. */
export const PENDING_HASH_KEY = "pendingClipboardHash";

/** Optional permissions needed to verify and clear the clipboard. */
export const CLIPBOARD_PERMISSIONS: chrome.permissions.Permissions = {
    permissions: ["clipboardRead", "clipboardWrite"],
};

/**
 * Type guard for {@link ScheduleClipboardClearMessage}. Validates the shape of
 * an untrusted runtime message: the hash must look like a SHA-256 digest and the
 * delay must be one of the choices offered in the UI.
 *
 * @param message - Value received from `chrome.runtime.onMessage`.
 * @returns `true` when `message` is a well-formed schedule request.
 */
export function isScheduleClipboardClear(message: unknown): message is ScheduleClipboardClearMessage {
    const m = message as Partial<ScheduleClipboardClearMessage> | null;
    return (
        typeof m === "object" &&
        m !== null &&
        m.type === "schedule-clipboard-clear" &&
        typeof m.hash === "string" &&
        /^[0-9a-f]{64}$/.test(m.hash) &&
        typeof m.delaySeconds === "number" &&
        m.delaySeconds > 0 &&
        (CLIPBOARD_CLEAR_CHOICES as readonly number[]).includes(m.delaySeconds)
    );
}

/**
 * Type guard for {@link ClearClipboardMessage}.
 *
 * @param message - Value received from `chrome.runtime.onMessage`.
 * @returns `true` when `message` is a well-formed clear request.
 */
export function isClearClipboard(message: unknown): message is ClearClipboardMessage {
    const m = message as Partial<ClearClipboardMessage> | null;
    return typeof m === "object" && m !== null && m.type === "offscreen-clear-clipboard" && typeof m.hash === "string";
}
