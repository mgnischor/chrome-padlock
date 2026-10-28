/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/popup/popup.ts
    Description: Popup user interface for the Padlock Chrome extension.
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
import { CHARSETS } from "../core/charsets";
import { classifyStrength } from "../core/entropy";
import { analyze, generatePassword, GeneratorError, MAX_LENGTH, MIN_LENGTH } from "../core/generator";
import { sha256Hex } from "../shared/hash";
import { HISTORY_LIMIT, clearHistory, loadHistory, recordPassword } from "../shared/history";
import {
    applyTranslations,
    browserLanguage,
    languageTag,
    setLanguage,
    t,
    textDirection,
    type MessageKey,
    type Substitutions,
} from "../shared/i18n";
import { LOCALES } from "../shared/locales";
import { CLIPBOARD_PERMISSIONS, type ScheduleClipboardClearMessage } from "../shared/messages";
import {
    DEFAULT_SETTINGS,
    MAX_EXCLUDE_CHARS,
    loadSettings,
    sanitizeSettings,
    saveSettings,
    type Settings,
} from "../shared/settings";

/** Delay before persisting, so dragging the slider does not hammer storage.sync. */
const SAVE_DEBOUNCE_MS = 400;

/** Message keys of the strength ratings, indexed by strength level. */
const STRENGTH_MESSAGES = [
    "strengthLevel0",
    "strengthLevel1",
    "strengthLevel2",
    "strengthLevel3",
    "strengthLevel4",
] as const satisfies readonly MessageKey[];

/** The screens of the popup. Only one is visible at a time. */
type View = "main" | "history" | "settings" | "about";

/**
 * Finds an element by id.
 *
 * @typeParam T - Expected element type.
 * @param id - Value of the element's `id` attribute.
 * @returns The element.
 * @throws Error when the page has no element with that id.
 */
function el<T extends HTMLElement>(id: string): T {
    const node = document.getElementById(id);
    if (!node) throw new Error(`Missing element #${id}`);
    return node as T;
}

const ui = {
    password: el<HTMLOutputElement>("password"),
    copy: el<HTMLButtonElement>("copy"),
    regenerate: el<HTMLButtonElement>("regenerate"),
    meter: el<HTMLElement>("meter"),
    strengthLabel: el<HTMLElement>("strength-label"),
    entropy: el<HTMLElement>("entropy"),
    status: el<HTMLElement>("status"),
    lengthRange: el<HTMLInputElement>("length"),
    lengthNumber: el<HTMLInputElement>("length-number"),
    lowercase: el<HTMLInputElement>("lowercase"),
    uppercase: el<HTMLInputElement>("uppercase"),
    digits: el<HTMLInputElement>("digits"),
    symbols: el<HTMLInputElement>("symbols"),
    ambiguous: el<HTMLInputElement>("ambiguous"),
    exclude: el<HTMLInputElement>("exclude"),
    settingsOpen: el<HTMLButtonElement>("settings-open"),
    aboutOpen: el<HTMLButtonElement>("about-open"),
    mainView: el<HTMLElement>("main-view"),
    historyView: el<HTMLElement>("history-view"),
    historyOpen: el<HTMLButtonElement>("history-open"),
    historyBack: el<HTMLButtonElement>("history-back"),
    historyClear: el<HTMLButtonElement>("history-clear"),
    historyList: el<HTMLOListElement>("history-list"),
    historyCount: el<HTMLElement>("history-count"),
    historyEmpty: el<HTMLElement>("history-empty"),
    historyStatus: el<HTMLElement>("history-status"),
    settingsView: el<HTMLElement>("settings-view"),
    settingsBack: el<HTMLButtonElement>("settings-back"),
    settingsReset: el<HTMLButtonElement>("settings-reset"),
    settingsStatus: el<HTMLElement>("settings-status"),
    language: el<HTMLSelectElement>("language"),
    theme: el<HTMLSelectElement>("theme"),
    clipboardClear: el<HTMLSelectElement>("clipboard-clear"),
    keepHistory: el<HTMLInputElement>("keep-history"),
    contextMenu: el<HTMLInputElement>("context-menu"),
    maskPasswords: el<HTMLInputElement>("mask-passwords"),
    aboutView: el<HTMLElement>("about-view"),
    aboutBack: el<HTMLButtonElement>("about-back"),
};

/** The view each screen lives in, and the status line it shows messages on. */
const VIEWS: Record<View, { element: HTMLElement; status: HTMLElement }> = {
    main: { element: ui.mainView, status: ui.status },
    history: { element: ui.historyView, status: ui.historyStatus },
    settings: { element: ui.settingsView, status: ui.settingsStatus },
    about: { element: ui.aboutView, status: ui.status },
};

let settings: Settings;
let currentView: View = "main";
/** Status line of whichever view is showing. */
let activeStatus: HTMLElement = ui.status;
/** Serialises history writes so quick successive changes cannot overwrite each other. */
let historyQueue: Promise<void> = Promise.resolve();
/** The password currently on screen; `null` when the options are invalid. */
let current: string | null = null;
let saveTimer: number | undefined;
let statusTimer: number | undefined;

/**
 * Shows a message on the status line of the visible view.
 *
 * @param text - Localized message; an empty string clears the line.
 * @param isError - Whether to style the message as an error.
 * @param autoClearMs - Milliseconds after which the message disappears; 0 keeps it.
 */
function setStatus(text: string, isError = false, autoClearMs = 0): void {
    window.clearTimeout(statusTimer);
    const target = activeStatus;
    target.textContent = text;
    target.classList.toggle("error", isError);
    if (autoClearMs > 0) {
        statusTimer = window.setTimeout(() => {
            target.textContent = "";
        }, autoClearMs);
    }
}

/**
 * Builds the password with digits and symbols tinted so look-alikes are easier to tell apart.
 *
 * @param password - Password to render.
 * @returns A fragment with one element per character.
 */
function colorize(password: string): DocumentFragment {
    const fragment = document.createDocumentFragment();
    for (const ch of password) {
        const span = document.createElement("span");
        if (CHARSETS.digits.includes(ch)) span.className = "digit";
        else if (!/[A-Za-z]/.test(ch)) span.className = "symbol";
        span.textContent = ch;
        fragment.append(span);
    }
    return fragment;
}

/**
 * Shows a password in the main output box.
 *
 * @param password - Password to display.
 */
function renderPassword(password: string): void {
    ui.password.classList.remove("error");
    ui.password.replaceChildren(colorize(password));
}

/** Updates the strength meter, its label and the entropy readout for the current options. */
function renderStrength(): void {
    const { entropyBits } = analyze(settings);
    if (entropyBits === 0) {
        ui.meter.dataset.level = "0";
        ui.meter.setAttribute("aria-valuenow", "0");
        ui.strengthLabel.textContent = "–";
        ui.entropy.textContent = "";
        return;
    }
    const level = classifyStrength(entropyBits);
    ui.meter.dataset.level = String(level);
    ui.meter.setAttribute("aria-valuenow", String(level));
    ui.strengthLabel.textContent = t(STRENGTH_MESSAGES[level]);
    ui.entropy.textContent = t("entropyBits", String(Math.floor(entropyBits)));
}

/**
 * Turns a generator failure into a localized message.
 *
 * @param error - Value thrown by the generator.
 * @returns A message for the user in the active language.
 */
function describeError(error: unknown): string {
    if (!(error instanceof GeneratorError)) return t("errorGeneric");
    switch (error.code) {
        case "INVALID_LENGTH":
            return t("errorInvalidLength", [String(MIN_LENGTH), String(MAX_LENGTH)]);
        case "NO_CHARSET":
            return t("errorNoCharset");
        case "LENGTH_TOO_SHORT":
            return t("errorLengthTooShort");
    }
}

/** Generates a new password with the current options and refreshes the display. */
function regenerate(): void {
    try {
        current = generatePassword(settings);
        renderPassword(current);
        setStatus("");
    } catch (error) {
        current = null;
        ui.password.classList.add("error");
        ui.password.textContent = describeError(error);
    }
    ui.copy.disabled = current === null;
    renderStrength();
}

/** Persists the settings shortly after the last change. */
function scheduleSave(): void {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
        saveSettings(settings).catch(() => setStatus(t("statusSaveFailed"), true));
    }, SAVE_DEBOUNCE_MS);
}

/** Applies the theme setting: the stylesheet reads it from the root element. */
function applyTheme(): void {
    document.documentElement.dataset.theme = settings.theme;
}

/** Applies the "blur passwords" setting: the stylesheet reads it from the root element. */
function applyMask(): void {
    document.documentElement.dataset.mask = String(settings.maskPasswords);
}

/**
 * Values that fill the `$1` placeholders of the messages shown in the page's static text.
 *
 * @returns Substitutions by message key, for {@link applyTranslations}.
 */
function substitutions(): Partial<Record<MessageKey, Substitutions>> {
    return {
        historyButtonTitle: String(HISTORY_LIMIT),
        keepHistoryLabel: String(HISTORY_LIMIT),
        contextMenuLabel: t("menuInsertPassword"),
        aboutVersion: chrome.runtime.getManifest().version,
    };
}

/**
 * Switches the whole interface to the language in the settings: the page's language and reading
 * direction, every translated text, and the texts that are built in code.
 */
function refreshLanguage(): void {
    setLanguage(settings.language, browserLanguage());
    document.documentElement.lang = languageTag();
    document.documentElement.dir = textDirection();
    applyTranslations(document, substitutions());
    renderStrength();
    if (current === null) regenerate();
    if (currentView === "history") void renderHistory();
}

/** Fills the language selector with every supported language, each named in its own language. */
function populateLanguages(): void {
    for (const locale of LOCALES) {
        const option = document.createElement("option");
        option.value = locale.code;
        option.textContent = locale.name;
        option.lang = locale.tag;
        ui.language.append(option);
    }
}

/** Pushes the current settings into the form controls. */
function renderForm(): void {
    ui.lengthRange.value = String(settings.length);
    ui.lengthNumber.value = String(settings.length);
    ui.lowercase.checked = settings.lowercase;
    ui.uppercase.checked = settings.uppercase;
    ui.digits.checked = settings.digits;
    ui.symbols.checked = settings.symbols;
    ui.ambiguous.checked = settings.excludeAmbiguous;
    ui.exclude.value = settings.excludeChars;
    ui.language.value = settings.language;
    ui.theme.value = settings.theme;
    ui.clipboardClear.value = String(settings.clipboardClearSeconds);
    ui.keepHistory.checked = settings.keepHistory;
    ui.contextMenu.checked = settings.contextMenu;
    ui.maskPasswords.checked = settings.maskPasswords;
    ui.historyOpen.hidden = !settings.keepHistory;
}

/** Stores the password currently on screen in the history, if the history is enabled. */
function recordCurrent(): void {
    if (!settings.keepHistory || current === null) return;
    const password = current;
    historyQueue = historyQueue.then(() => recordPassword(password)).catch(() => undefined);
}

/** Applies the history checkbox: shows or hides the History button and deletes the history when turned off. */
async function onKeepHistoryChanged(): Promise<void> {
    settings = sanitizeSettings({ ...settings, keepHistory: ui.keepHistory.checked });
    ui.historyOpen.hidden = !settings.keepHistory;
    scheduleSave();
    if (settings.keepHistory) {
        recordCurrent();
    } else {
        await historyQueue;
        await clearHistory();
    }
}

/**
 * Formats a history timestamp for the active language.
 *
 * @param timestamp - Unix time in milliseconds.
 * @returns A short date and time such as `23/10/2026, 15:42:02`.
 */
function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString(languageTag(), { dateStyle: "short", timeStyle: "medium" });
}

/** Reloads the history from storage and redraws the list. */
async function renderHistory(): Promise<void> {
    await historyQueue;
    const entries = await loadHistory();
    ui.historyCount.textContent = `${entries.length} / ${HISTORY_LIMIT}`;
    ui.historyEmpty.hidden = entries.length > 0;
    ui.historyClear.disabled = entries.length === 0;

    ui.historyList.replaceChildren(
        ...entries.map((entry) => {
            const item = document.createElement("li");
            item.className = "history-item";

            const text = document.createElement("div");
            text.className = "history-text";
            const password = document.createElement("span");
            password.className = "history-password";
            password.append(colorize(entry.password));
            const time = document.createElement("span");
            time.className = "history-time";
            time.textContent = formatTime(entry.createdAt);
            text.append(password, time);

            const copy = document.createElement("button");
            copy.type = "button";
            copy.textContent = t("copy");
            copy.addEventListener("click", () => void copyToClipboard(entry.password));

            item.append(text, copy);
            return item;
        })
    );
}

/**
 * Shows one screen of the popup and hides the others.
 *
 * @param view - The screen to show.
 */
function showView(view: View): void {
    currentView = view;
    for (const [name, { element }] of Object.entries(VIEWS)) element.hidden = name !== view;
    activeStatus = VIEWS[view].status;
    setStatus("");
    if (view === "history") void renderHistory();
}

/** Deletes the whole history and refreshes the list. */
async function onClearHistory(): Promise<void> {
    await historyQueue;
    await clearHistory();
    await renderHistory();
    setStatus(t("historyCleared"), false, 3000);
}

/**
 * Reads the form controls back into settings, then regenerates and persists.
 *
 * @param source - Which length control triggered the change, if any.
 */
function onOptionsChanged(source?: "range" | "number"): void {
    const rawLength = source === "number" ? ui.lengthNumber.value : ui.lengthRange.value;
    settings = sanitizeSettings({
        ...settings,
        length: rawLength === "" ? settings.length : Number(rawLength),
        lowercase: ui.lowercase.checked,
        uppercase: ui.uppercase.checked,
        digits: ui.digits.checked,
        symbols: ui.symbols.checked,
        excludeAmbiguous: ui.ambiguous.checked,
        excludeChars: ui.exclude.value,
    });
    // Keep the two length controls in sync. Skip the field being typed in so
    // that clearing it to type a new number is not overwritten mid-edit.
    ui.lengthRange.value = String(settings.length);
    if (source !== "number") ui.lengthNumber.value = String(settings.length);
    regenerate();
    scheduleSave();
}

/** Applies the language selector: every text of the popup switches immediately. */
function onLanguageChanged(): void {
    settings = sanitizeSettings({ ...settings, language: ui.language.value });
    refreshLanguage();
    scheduleSave();
}

/** Applies the theme selector. */
function onThemeChanged(): void {
    settings = sanitizeSettings({ ...settings, theme: ui.theme.value });
    applyTheme();
    scheduleSave();
}

/** Applies the "right-click menu" checkbox. The service worker adds or removes the menu item when the setting is saved. */
function onContextMenuChanged(): void {
    settings = sanitizeSettings({ ...settings, contextMenu: ui.contextMenu.checked });
    scheduleSave();
}

/** Applies the "blur passwords" checkbox. */
function onMaskChanged(): void {
    settings = sanitizeSettings({ ...settings, maskPasswords: ui.maskPasswords.checked });
    applyMask();
    scheduleSave();
}

/** Restores every setting to its default, including the language and theme, and deletes the history. */
async function onResetSettings(): Promise<void> {
    const hadHistory = settings.keepHistory;
    settings = { ...DEFAULT_SETTINGS };
    renderForm();
    applyTheme();
    applyMask();
    refreshLanguage();
    regenerate();
    scheduleSave();
    if (hadHistory) {
        await historyQueue;
        await clearHistory();
    }
    setStatus(t("settingsReset"), false, 3000);
}

/**
 * Checks whether the optional clipboard permissions are currently granted.
 *
 * @returns `true` when the clipboard can be read and written for auto-clear.
 */
async function hasClipboardPermission(): Promise<boolean> {
    return chrome.permissions.contains(CLIPBOARD_PERMISSIONS);
}

/**
 * Copies a password and arms the optional clipboard clear.
 *
 * @param password - Password to copy; the one on screen by default.
 */
async function copyToClipboard(password: string | null = current): Promise<void> {
    if (password === null) return;
    try {
        await navigator.clipboard.writeText(password);
    } catch {
        setStatus(t("statusCopyFailed"), true);
        return;
    }

    const delaySeconds = settings.clipboardClearSeconds;
    if (delaySeconds === 0) {
        setStatus(t("statusCopied"), false, 3000);
        return;
    }
    if (!(await hasClipboardPermission())) {
        setStatus(t("statusCopiedNoPermission"), true);
        return;
    }
    const message: ScheduleClipboardClearMessage = {
        type: "schedule-clipboard-clear",
        hash: await sha256Hex(password),
        delaySeconds,
    };
    try {
        // The service worker answers `true` only once the timer is armed. Never claim otherwise.
        if ((await chrome.runtime.sendMessage(message)) !== true) throw new Error("Scheduling was rejected");
        setStatus(t("statusCopiedClearIn", String(delaySeconds)), false, 5000);
    } catch {
        setStatus(t("statusScheduleFailed"), true);
    }
}

/** Applies the clipboard auto-clear selector, requesting the optional permissions when it is turned on. */
async function onClipboardClearChanged(): Promise<void> {
    const seconds = Number(ui.clipboardClear.value);
    if (seconds > 0) {
        // Must be requested from a user gesture; this runs inside the change event.
        const granted = await chrome.permissions.request(CLIPBOARD_PERMISSIONS).catch(() => false);
        if (!granted) {
            ui.clipboardClear.value = "0";
            settings = { ...settings, clipboardClearSeconds: 0 };
            setStatus(t("statusClipboardPermissionRequired"), true);
            scheduleSave();
            return;
        }
    }
    settings = sanitizeSettings({ ...settings, clipboardClearSeconds: seconds });
    scheduleSave();
}

/** Attaches every event listener of the popup. */
function bindEvents(): void {
    ui.lengthRange.addEventListener("input", () => onOptionsChanged("range"));
    ui.lengthNumber.addEventListener("input", () => {
        if (ui.lengthNumber.value !== "") onOptionsChanged("number");
    });
    // While a slider is dragged or a field is typed in, every tick shows a new
    // password. Only the settled one (on `change`) is recorded in the history.
    ui.lengthRange.addEventListener("change", recordCurrent);
    // On blur or Enter, snap an empty or out-of-range number back into range.
    ui.lengthNumber.addEventListener("change", () => {
        onOptionsChanged("number");
        ui.lengthNumber.value = String(settings.length);
        recordCurrent();
    });
    for (const box of [ui.lowercase, ui.uppercase, ui.digits, ui.symbols, ui.ambiguous]) {
        box.addEventListener("change", () => {
            onOptionsChanged();
            recordCurrent();
        });
    }
    ui.exclude.addEventListener("input", () => onOptionsChanged());
    ui.exclude.addEventListener("change", recordCurrent);

    ui.language.addEventListener("change", onLanguageChanged);
    ui.theme.addEventListener("change", onThemeChanged);
    ui.clipboardClear.addEventListener("change", () => void onClipboardClearChanged());
    ui.keepHistory.addEventListener("change", () => void onKeepHistoryChanged());
    ui.contextMenu.addEventListener("change", onContextMenuChanged);
    ui.maskPasswords.addEventListener("change", onMaskChanged);
    ui.settingsReset.addEventListener("click", () => void onResetSettings());

    ui.settingsOpen.addEventListener("click", () => showView("settings"));
    ui.aboutOpen.addEventListener("click", () => showView("about"));
    ui.historyOpen.addEventListener("click", () => showView("history"));
    for (const back of [ui.historyBack, ui.settingsBack, ui.aboutBack]) {
        back.addEventListener("click", () => showView("main"));
    }
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && currentView !== "main") showView("main");
    });
    ui.historyClear.addEventListener("click", () => void onClearHistory());

    ui.regenerate.addEventListener("click", () => {
        regenerate();
        recordCurrent();
    });
    ui.copy.addEventListener("click", () => void copyToClipboard());
    ui.password.addEventListener("click", () => void copyToClipboard());
    ui.password.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            void copyToClipboard();
        }
    });
}

/** Loads the settings, applies the saved language and theme, and shows the first password. */
async function init(): Promise<void> {
    try {
        settings = await loadSettings();
        populateLanguages();
        applyTheme();
        applyMask();
        refreshLanguage();

        ui.lengthRange.min = ui.lengthNumber.min = String(MIN_LENGTH);
        ui.lengthRange.max = ui.lengthNumber.max = String(MAX_LENGTH);
        ui.exclude.maxLength = MAX_EXCLUDE_CHARS;

        renderForm();
        bindEvents();
        regenerate();
        recordCurrent();
    } finally {
        // The page stays hidden until the language and theme are applied; see popup.css.
        document.documentElement.classList.add("ready");
    }
}

void init();
