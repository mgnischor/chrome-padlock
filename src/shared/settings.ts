/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/shared/settings.ts
    Description: Persisted user settings with validation and storage helpers.
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
import { DEFAULT_GENERATOR_OPTIONS, MAX_LENGTH, MIN_LENGTH, type GeneratorOptions } from "../core/generator";

/** Allowed values for "clear clipboard after", in seconds. 0 disables the feature. */
export const CLIPBOARD_CLEAR_CHOICES = [0, 30, 60, 120] as const;

/** Upper bound for the free-form exclusion field. */
export const MAX_EXCLUDE_CHARS = 64;

/** Everything persisted between sessions. Passwords themselves are never stored. */
export interface Settings extends GeneratorOptions {
    clipboardClearSeconds: number;
    /** Keep the most recently generated passwords (in memory only) so they can be viewed again. */
    keepHistory: boolean;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
    ...DEFAULT_GENERATOR_OPTIONS,
    clipboardClearSeconds: 0,
    keepHistory: false,
};

const STORAGE_KEY = "settings";

/**
 * Narrows an unknown value to a boolean.
 *
 * @param value - Value to check.
 * @param fallback - Result used when `value` is not a boolean.
 * @returns `value` when it is a boolean, otherwise `fallback`.
 */
function bool(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
}

/**
 * Turns untrusted stored data into valid settings. Unknown or malformed fields
 * fall back to their defaults so a corrupted store can never break the UI.
 *
 * @param raw - Value read from storage or assembled from form controls.
 * @returns Valid settings: length clamped to range, flags typed, delays from the allowed choices.
 */
export function sanitizeSettings(raw: unknown): Settings {
    const isRecord = typeof raw === "object" && raw !== null && !Array.isArray(raw);
    const input = (isRecord ? raw : {}) as Record<string, unknown>;
    const defaults = DEFAULT_SETTINGS;

    const length =
        typeof input.length === "number" && Number.isFinite(input.length)
            ? Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, Math.round(input.length)))
            : defaults.length;

    const clear = input.clipboardClearSeconds;
    const clipboardClearSeconds =
        CLIPBOARD_CLEAR_CHOICES.find((choice) => choice === clear) ?? defaults.clipboardClearSeconds;

    return {
        length,
        lowercase: bool(input.lowercase, defaults.lowercase),
        uppercase: bool(input.uppercase, defaults.uppercase),
        digits: bool(input.digits, defaults.digits),
        symbols: bool(input.symbols, defaults.symbols),
        excludeAmbiguous: bool(input.excludeAmbiguous, defaults.excludeAmbiguous),
        excludeChars: typeof input.excludeChars === "string" ? input.excludeChars.slice(0, MAX_EXCLUDE_CHARS) : "",
        clipboardClearSeconds,
        keepHistory: bool(input.keepHistory, defaults.keepHistory),
    };
}

/**
 * Reads the settings from `chrome.storage.sync`.
 *
 * @returns The stored settings, or the defaults when none exist or storage is unavailable.
 */
export async function loadSettings(): Promise<Settings> {
    try {
        const stored = await chrome.storage.sync.get(STORAGE_KEY);
        return sanitizeSettings(stored[STORAGE_KEY]);
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

/**
 * Writes the settings to `chrome.storage.sync`.
 *
 * @param settings - Settings to persist.
 */
export async function saveSettings(settings: Settings): Promise<void> {
    await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
}
