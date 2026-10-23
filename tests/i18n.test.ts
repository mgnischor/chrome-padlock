/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/i18n.test.ts
    Description: Unit tests for the locale files and the translation helper.
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
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "../src/shared/i18n";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCALES_DIR = path.join(ROOT, "public", "_locales");
const DEFAULT_LOCALE = "en_US";
const EXPECTED_LOCALES = ["en_US", "es", "pt_BR"];

/** Shape of one entry of a `messages.json` file. */
interface Message {
    message: string;
    placeholders?: Record<string, { content: string }>;
}

/**
 * Reads the messages of one locale.
 *
 * @param locale - Locale folder name such as `pt_BR`.
 * @returns The parsed `messages.json`.
 */
function loadLocale(locale: string): Record<string, Message> {
    return JSON.parse(readFileSync(path.join(LOCALES_DIR, locale, "messages.json"), "utf8"));
}

/**
 * Lists the `$NAME$` placeholders referenced by a message, lowercased and sorted.
 *
 * @param text - Message text.
 * @returns The referenced placeholder names.
 */
function referencedPlaceholders(text: string): string[] {
    return [...text.matchAll(/\$([A-Za-z0-9_@]+)\$/g)].map((match) => match[1]!.toLowerCase()).sort();
}

/**
 * Collects the files under a directory whose name matches an extension.
 *
 * @param dir - Directory to walk.
 * @param extensions - Accepted file extensions, including the dot.
 * @returns Absolute paths of the matching files.
 */
function listFiles(dir: string, extensions: readonly string[]): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return listFiles(full, extensions);
        return extensions.includes(path.extname(entry.name)) ? [full] : [];
    });
}

const defaults = loadLocale(DEFAULT_LOCALE);

describe("locales", () => {
    it("ships exactly the supported languages", () => {
        expect(readdirSync(LOCALES_DIR).sort()).toEqual(EXPECTED_LOCALES);
    });

    it.each(EXPECTED_LOCALES)("%s defines the same keys as the default locale", (locale) => {
        expect(Object.keys(loadLocale(locale)).sort()).toEqual(Object.keys(defaults).sort());
    });

    it.each(EXPECTED_LOCALES)("%s has no empty messages", (locale) => {
        for (const [key, entry] of Object.entries(loadLocale(locale))) {
            expect(entry.message.trim(), `${locale}.${key}`).not.toBe("");
        }
    });

    it.each(EXPECTED_LOCALES)("%s uses the same placeholders as the default locale", (locale) => {
        const messages = loadLocale(locale);
        for (const [key, entry] of Object.entries(defaults)) {
            const translated = messages[key]!;
            expect(Object.keys(translated.placeholders ?? {}).sort(), `${locale}.${key}`).toEqual(
                Object.keys(entry.placeholders ?? {}).sort()
            );
            expect(referencedPlaceholders(translated.message), `${locale}.${key}`).toEqual(
                referencedPlaceholders(entry.message)
            );
            for (const name of referencedPlaceholders(translated.message)) {
                const declared = Object.keys(translated.placeholders ?? {}).map((n) => n.toLowerCase());
                expect(declared, `${locale}.${key} references $${name}$`).toContain(name);
            }
        }
    });

    it.each(EXPECTED_LOCALES)("%s respects the Chrome Web Store length limits", (locale) => {
        const messages = loadLocale(locale);
        expect(messages.extDescription!.message.length).toBeLessThanOrEqual(132);
        expect(messages.extName!.message.length).toBeLessThanOrEqual(45);
        expect(messages.extShortName!.message.length).toBeLessThanOrEqual(12);
    });
});

describe("message usage", () => {
    const sources = [
        // The helper's own documentation contains example markup such as data-i18n="key".
        ...listFiles(path.join(ROOT, "src"), [".ts"]).filter((file) => !file.endsWith("i18n.ts")),
        ...listFiles(path.join(ROOT, "public"), [".html", ".json"]).filter((file) => !file.includes("_locales")),
    ].map((file) => readFileSync(file, "utf8"));
    const allSource = sources.join("\n");

    it("defines every key referenced from HTML data attributes, the manifest and t() calls", () => {
        const referenced = new Set<string>();
        for (const match of allSource.matchAll(/data-i18n(?:-[a-z-]+)?="([A-Za-z0-9_]+)"/g)) referenced.add(match[1]!);
        for (const match of allSource.matchAll(/__MSG_([A-Za-z0-9_@]+)__/g)) referenced.add(match[1]!);
        for (const match of allSource.matchAll(/\bt\(\s*"([A-Za-z0-9_]+)"/g)) referenced.add(match[1]!);

        expect(referenced.size).toBeGreaterThan(0);
        for (const key of referenced) expect(Object.keys(defaults), `missing message "${key}"`).toContain(key);
    });

    it("has no unused messages", () => {
        for (const key of Object.keys(defaults)) {
            expect(allSource.includes(`"${key}"`) || allSource.includes(`__MSG_${key}__`), `unused "${key}"`).toBe(
                true
            );
        }
    });

    it("declares the default locale in the manifest", () => {
        const manifest = JSON.parse(readFileSync(path.join(ROOT, "public", "manifest.json"), "utf8"));
        expect(manifest.default_locale).toBe(DEFAULT_LOCALE);
    });
});

describe("t", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("returns the localized message", () => {
        vi.stubGlobal("chrome", { i18n: { getMessage: () => "Copiar" } });
        expect(t("copy")).toBe("Copiar");
    });

    it("passes substitutions through to chrome.i18n", () => {
        const getMessage = vi.fn(() => "30 s");
        vi.stubGlobal("chrome", { i18n: { getMessage } });
        t("statusCopiedClearIn", "30");
        expect(getMessage).toHaveBeenCalledWith("statusCopiedClearIn", "30");
    });

    it("falls back to the key when the message is missing", () => {
        vi.stubGlobal("chrome", { i18n: { getMessage: () => "" } });
        expect(t("copy")).toBe("copy");
    });
});
