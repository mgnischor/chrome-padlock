/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/shared/history.ts
    Description: Opt-in, memory-only history of the most recently generated passwords.
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
import { MAX_LENGTH } from "../core/generator";

/** Maximum number of passwords kept in the history. */
export const HISTORY_LIMIT = 50;

const STORAGE_KEY = "passwordHistory";

/**
 * Resolves the storage area that holds the history. It is looked up lazily so
 * that importing this module never touches `chrome` (for example in tests).
 *
 * `storage.session` is memory only: it is never written to disk and disappears
 * when the browser closes. Switch to `chrome.storage.local` to survive
 * restarts, at the cost of keeping plain-text passwords on disk.
 *
 * @returns The storage area used for the history.
 */
const storageArea = () => chrome.storage.session;

export interface HistoryEntry {
    password: string;
    /** Unix time in milliseconds. */
    createdAt: number;
}

/**
 * Returns a new list with `password` added at the front (newest first),
 * capped at `HISTORY_LIMIT`. Re-adding the password that is already at the
 * front is a no-op, so committing the same password twice does not duplicate it.
 *
 * @param entries - Current history, newest first. It is not modified.
 * @param password - Password to add.
 * @param now - Creation time in Unix milliseconds.
 * @returns The updated history.
 */
export function pushEntry(entries: readonly HistoryEntry[], password: string, now: number): HistoryEntry[] {
    if (entries[0]?.password === password) return [...entries];
    return [{ password, createdAt: now }, ...entries].slice(0, HISTORY_LIMIT);
}

/**
 * Turns untrusted stored data into a valid history list, dropping malformed entries.
 *
 * @param raw - Value read from storage.
 * @returns A valid history of at most `HISTORY_LIMIT` entries.
 */
export function sanitizeHistory(raw: unknown): HistoryEntry[] {
    if (!Array.isArray(raw)) return [];
    const entries: HistoryEntry[] = [];
    for (const item of raw) {
        const candidate = item as Partial<HistoryEntry> | null;
        if (
            typeof candidate === "object" &&
            candidate !== null &&
            typeof candidate.password === "string" &&
            candidate.password.length > 0 &&
            candidate.password.length <= MAX_LENGTH &&
            typeof candidate.createdAt === "number" &&
            Number.isFinite(candidate.createdAt)
        ) {
            entries.push({ password: candidate.password, createdAt: candidate.createdAt });
        }
    }
    return entries.slice(0, HISTORY_LIMIT);
}

/**
 * Reads the history from storage.
 *
 * @returns The stored history, newest first; empty when none exists or storage is unavailable.
 */
export async function loadHistory(): Promise<HistoryEntry[]> {
    try {
        const stored = await storageArea().get(STORAGE_KEY);
        return sanitizeHistory(stored[STORAGE_KEY]);
    } catch {
        return [];
    }
}

/**
 * Adds a password to the history. Callers must check that the history is enabled.
 *
 * @param password - Password to record.
 */
export async function recordPassword(password: string): Promise<void> {
    const entries = await loadHistory();
    await storageArea().set({ [STORAGE_KEY]: pushEntry(entries, password, Date.now()) });
}

/** Deletes the whole history. */
export async function clearHistory(): Promise<void> {
    await storageArea().remove(STORAGE_KEY);
}
