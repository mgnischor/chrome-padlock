/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/background/service-worker.ts
    Description: Background service worker for the Padlock Chrome extension.
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
import { generatePassword } from "../core/generator";
import {
    CLIPBOARD_CLEAR_ALARM,
    PENDING_HASH_KEY,
    isScheduleClipboardClear,
    type ClearClipboardMessage,
} from "../shared/messages";
import { recordPassword } from "../shared/history";
import { browserLanguage, setLanguage, t } from "../shared/i18n";
import { loadSettings } from "../shared/settings";

const MENU_ID = "insert-password";
const OFFSCREEN_URL = "offscreen.html";
const BADGE_RESET_MS = 2000;
const SETTINGS_STORAGE_KEY = "settings";

// ---------------------------------------------------------------------------
// Browser surfaces: the toolbar tooltip and the context menu entry
// ---------------------------------------------------------------------------

/**
 * Brings the toolbar tooltip and the right-click menu in line with the settings: they use the
 * language the user chose (or the browser's), and the menu entry only exists when it is enabled.
 * Existing entries are removed first so the menu never ends up duplicated.
 */
async function syncBrowserSurfaces(): Promise<void> {
    const settings = await loadSettings();
    setLanguage(settings.language, browserLanguage());
    void chrome.action.setTitle({ title: t("actionTitle") });
    chrome.contextMenus.removeAll(() => {
        if (!settings.contextMenu) return;
        chrome.contextMenus.create({
            id: MENU_ID,
            title: t("menuInsertPassword"),
            contexts: ["editable"],
        });
    });
}

// Recreate on startup too, so the titles follow a changed browser language.
chrome.runtime.onInstalled.addListener(() => void syncBrowserSurfaces());
chrome.runtime.onStartup.addListener(() => void syncBrowserSurfaces());
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && SETTINGS_STORAGE_KEY in changes) void syncBrowserSurfaces();
});

/**
 * Runs inside the page (injected with `chrome.scripting.executeScript`), so it
 * must be fully self-contained. Sets the value through the native setter and
 * fires events so frameworks such as React notice the change.
 *
 * @param password - Password to insert into the focused field.
 * @returns `true` when a text field had focus and received the password.
 */
function insertIntoFocusedField(password: string): boolean {
    let active: Element | null = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;

    let setter: ((value: string) => void) | undefined;
    if (active instanceof HTMLInputElement) {
        setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    } else if (active instanceof HTMLTextAreaElement) {
        setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    }
    if (!active || !setter) return false;

    setter.call(active, password);
    active.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    active.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
}

/**
 * Shows a short-lived badge on the toolbar button of a tab as feedback.
 *
 * @param tabId - Tab whose badge to set.
 * @param text - Badge text.
 */
function flashBadge(tabId: number, text: string): void {
    void chrome.action.setBadgeText({ tabId, text });
    setTimeout(() => void chrome.action.setBadgeText({ tabId, text: "" }), BADGE_RESET_MS);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId !== MENU_ID || tab?.id === undefined) return;
    const tabId = tab.id;

    try {
        const settings = await loadSettings();
        const password = generatePassword(settings);
        if (settings.keepHistory) await recordPassword(password);
        const [result] = await chrome.scripting.executeScript({
            target: info.frameId === undefined ? { tabId } : { tabId, frameIds: [info.frameId] },
            func: insertIntoFocusedField,
            args: [password],
        });
        flashBadge(tabId, result?.result ? "OK" : "!");
    } catch {
        // Restricted pages (chrome://, the Web Store, ...) cannot be scripted.
        flashBadge(tabId, "!");
    }
});

// ---------------------------------------------------------------------------
// Clipboard auto-clear
//
// The popup closes as soon as it loses focus, so the timer lives here. The
// service worker has no DOM and therefore no clipboard access; the actual
// clearing is delegated to an offscreen document. Only a SHA-256 hash of the
// copied password is kept, in memory-only session storage.
// ---------------------------------------------------------------------------

// Session storage is limited to trusted extension contexts by default; state it explicitly so a
// future change of the default can never expose the history or the pending hash to content scripts.
void chrome.storage.session.setAccessLevel({ accessLevel: chrome.storage.AccessLevel.TRUSTED_CONTEXTS });

/**
 * Remembers the hash of a copied password and arms the alarm that will clear it.
 *
 * @param hash - SHA-256 (hex) of the copied password.
 * @param delaySeconds - Seconds to wait before clearing the clipboard.
 */
async function scheduleClipboardClear(hash: string, delaySeconds: number): Promise<void> {
    await chrome.storage.session.set({ [PENDING_HASH_KEY]: hash });
    // Chrome enforces a 30 second minimum for alarms.
    await chrome.alarms.create(CLIPBOARD_CLEAR_ALARM, { delayInMinutes: Math.max(delaySeconds, 30) / 60 });
}

/**
 * Asks an offscreen document to clear the clipboard if it still holds the
 * copied password, then closes the document again.
 *
 * @param hash - SHA-256 (hex) of the copied password.
 */
async function clearClipboard(hash: string): Promise<void> {
    try {
        await chrome.offscreen.createDocument({
            url: OFFSCREEN_URL,
            reasons: [chrome.offscreen.Reason.CLIPBOARD],
            justification: "Clear the clipboard after a copied password has expired.",
        });
    } catch (error) {
        // A document left over from an earlier run is fine; anything else must not be swallowed.
        if (!String(error).includes("Only a single offscreen document")) throw error;
    }
    try {
        const message: ClearClipboardMessage = { type: "offscreen-clear-clipboard", hash };
        await chrome.runtime.sendMessage(message);
    } finally {
        await chrome.offscreen.closeDocument().catch(() => undefined);
    }
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || !isScheduleClipboardClear(message)) return false;

    scheduleClipboardClear(message.hash, message.delaySeconds).then(
        () => sendResponse(true),
        () => sendResponse(false)
    );
    return true; // keep the channel open for the async response
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== CLIPBOARD_CLEAR_ALARM) return;

    const stored = await chrome.storage.session.get(PENDING_HASH_KEY);
    const hash = stored[PENDING_HASH_KEY];
    await chrome.storage.session.remove(PENDING_HASH_KEY);
    if (typeof hash === "string") await clearClipboard(hash);
});
