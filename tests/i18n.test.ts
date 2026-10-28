/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/i18n.test.ts
    Description: Unit tests for the translation files, language matching and message lookup.
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
import { afterEach, describe, expect, it } from "vitest";
import { MANIFEST_KEYS, MANIFEST_LOCALES } from "../scripts/manifest-locales.mjs";
import { CATALOG } from "../src/shared/catalog";
import { formatMessage, languageTag, setLanguage, t, textDirection } from "../src/shared/i18n";
import { DEFAULT_LOCALE, LOCALES, isLocaleCode, matchLocale } from "../src/shared/locales";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCALES_DIR = path.join(ROOT, "src", "locales");

/** Shape of one entry of a translation file. */
interface Message {
    message: string;
    description?: string;
    placeholders?: Record<string, { content: string; example?: string }>;
}

/**
 * Reads the messages of one language.
 *
 * @param code - Language code such as `pt_BR`.
 * @returns The parsed translation file.
 */
function loadLocale(code: string): Record<string, Message> {
    return JSON.parse(readFileSync(path.join(LOCALES_DIR, `${code}.json`), "utf8"));
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
 * Collects the files under a directory whose name has one of the given extensions.
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

const CODES = LOCALES.map((locale) => locale.code);
const TRANSLATED_CODES = CODES.filter((code) => code !== DEFAULT_LOCALE);
const defaults = loadLocale(DEFAULT_LOCALE);

describe("supported languages", () => {
    it("lists 30 languages, with Chinese in two scripts", () => {
        expect(CODES).toHaveLength(31);
        expect(new Set(CODES.map((code) => code.split("_")[0])).size).toBe(30);
    });

    it("has exactly one translation file per listed language", () => {
        const files = readdirSync(LOCALES_DIR).map((file) => file.replace(/\.json$/, ""));
        expect(files.sort()).toEqual([...CODES].sort());
    });

    it("lists every language once, with a name, a language tag and a direction", () => {
        expect(new Set(CODES).size).toBe(CODES.length);
        for (const locale of LOCALES) {
            expect(locale.name.trim(), locale.code).not.toBe("");
            expect(locale.tag, locale.code).toMatch(/^[a-z]{2,3}(-[A-Z]{2})?$/);
        }
    });

    it("marks Arabic, Persian and Urdu as right-to-left and nothing else", () => {
        const rtl = LOCALES.filter((locale) => locale.dir === "rtl").map((locale) => locale.code);
        expect(rtl.sort()).toEqual(["ar", "fa", "ur"]);
    });

    it("is typed so that every language has a catalog entry", () => {
        expect(Object.keys(CATALOG).sort()).toEqual([...CODES].sort());
    });
});

describe("translation files", () => {
    it.each(CODES)("%s defines the same keys as the default language", (code) => {
        expect(Object.keys(loadLocale(code)).sort()).toEqual(Object.keys(defaults).sort());
    });

    it.each(CODES)("%s has no empty message", (code) => {
        for (const [key, entry] of Object.entries(loadLocale(code))) {
            expect(entry.message.trim(), `${code}.${key}`).not.toBe("");
        }
    });

    it.each(CODES)("%s uses the same placeholders as the default language", (code) => {
        const messages = loadLocale(code);
        for (const [key, entry] of Object.entries(defaults)) {
            const translated = messages[key]!;
            expect(Object.keys(translated.placeholders ?? {}).sort(), `${code}.${key}`).toEqual(
                Object.keys(entry.placeholders ?? {}).sort()
            );
            expect(referencedPlaceholders(translated.message), `${code}.${key}`).toEqual(
                referencedPlaceholders(entry.message)
            );
            for (const name of referencedPlaceholders(translated.message)) {
                const declared = Object.keys(translated.placeholders ?? {}).map((n) => n.toLowerCase());
                expect(declared, `${code}.${key} references $${name}$`).toContain(name);
            }
        }
    });

    it.each(TRANSLATED_CODES)("%s is translated, not a copy of the default language", (code) => {
        const messages = loadLocale(code);
        const untranslated = Object.keys(defaults).filter((key) => messages[key]!.message === defaults[key]!.message);
        // A few strings (the product name, "1" ...) legitimately match; most must not.
        expect(untranslated.length, untranslated.join(", ")).toBeLessThan(Object.keys(defaults).length * 0.1);
        for (const key of ["tagline", "copy", "footer", "keepHistoryHint", "aboutPrivacy"]) {
            expect(messages[key]!.message, key).not.toBe(defaults[key]!.message);
        }
    });

    it.each(CODES)("%s respects the Chrome Web Store length limits", (code) => {
        const messages = loadLocale(code);
        expect(messages.extDescription!.message.length).toBeLessThanOrEqual(132);
        expect(messages.extName!.message.length).toBeLessThanOrEqual(45);
        expect(messages.extShortName!.message.length).toBeLessThanOrEqual(12);
    });

    it.each(CODES)("%s keeps the product name, the author and the license in the right places", (code) => {
        const messages = loadLocale(code);
        expect(messages.extShortName!.message).toBe("Padlock");
        expect(messages.extName!.message).toContain("Padlock");
        expect(messages.aboutAuthor!.message).toContain("Miguel Nischor");
        expect(messages.aboutLicense!.message).toContain("Apache");
    });
});

describe("messages Chrome reads for the manifest", () => {
    it("are generated for supported languages only", () => {
        for (const code of MANIFEST_LOCALES) expect(isLocaleCode(code), code).toBe(true);
        const withoutFolder = CODES.filter((code) => !MANIFEST_LOCALES.includes(code));
        // Chrome has no UI language for these, so their manifest strings fall back to English.
        expect(withoutFolder.sort()).toEqual(["bho", "ha", "jv", "pa", "ur"]);
    });

    it("exist in every language that gets a _locales folder", () => {
        for (const code of MANIFEST_LOCALES) {
            const messages = loadLocale(code);
            for (const key of MANIFEST_KEYS) expect(messages[key], `${code}.${key}`).toBeDefined();
        }
    });

    it("cover every __MSG_ reference of the manifest", () => {
        const manifest = readFileSync(path.join(ROOT, "public", "manifest.json"), "utf8");
        const referenced = [...manifest.matchAll(/__MSG_([A-Za-z0-9_@]+)__/g)].map((match) => match[1]);
        expect(referenced.sort()).toEqual([...MANIFEST_KEYS].sort());
        expect(JSON.parse(manifest).default_locale).toBe(DEFAULT_LOCALE);
    });
});

describe("matchLocale", () => {
    it.each([
        ["en-US", "en_US"],
        ["en-GB", "en_US"],
        ["en", "en_US"],
        ["pt-BR", "pt_BR"],
        ["pt-PT", "pt_BR"],
        ["es-419", "es"],
        ["es-ES", "es"],
        ["zh-CN", "zh_CN"],
        ["zh", "zh_CN"],
        ["zh-Hans", "zh_CN"],
        ["zh-TW", "zh_TW"],
        ["zh-HK", "zh_TW"],
        ["zh-Hant", "zh_TW"],
        ["de-AT", "de"],
        ["ur", "ur"],
        ["ar-EG", "ar"],
        ["fa-IR", "fa"],
        ["id", "id"],
        ["uk", "uk"],
        ["fr-CA", "fr"],
        ["pa-IN", "pa"],
    ])("maps %s to %s", (tag, expected) => {
        expect(matchLocale(tag)).toBe(expected);
    });

    it.each(["", "xx", "fil", "he", "nb", "sw", "_"])("falls back to English for %j", (tag) => {
        expect(matchLocale(tag)).toBe(DEFAULT_LOCALE);
    });

    it("always returns a supported language", () => {
        for (const tag of ["en", "zh-TW", "ja-JP", "ko-KR", "ru-RU", "tr-TR", "vi-VN", "garbage"]) {
            expect(isLocaleCode(matchLocale(tag)), tag).toBe(true);
        }
    });
});

describe("formatMessage", () => {
    it("fills named placeholders from the substitutions", () => {
        const entry = { message: "Hi $NAME$!", placeholders: { name: { content: "$1" } } };
        expect(formatMessage(entry, "Ana")).toBe("Hi Ana!");
        expect(formatMessage(entry, ["Ana"])).toBe("Hi Ana!");
    });

    it("matches placeholder names without regard to case and fills several values", () => {
        const entry = {
            message: "Between $min$ and $Max$",
            placeholders: { MIN: { content: "$1" }, max: { content: "$2" } },
        };
        expect(formatMessage(entry, ["4", "128"])).toBe("Between 4 and 128");
    });

    it("supports literal placeholder content and positional markers", () => {
        expect(formatMessage({ message: "$X$ and $1", placeholders: { x: { content: "fixed" } } }, "one")).toBe(
            "fixed and one"
        );
    });

    it("turns $$ into a dollar sign and leaves other text alone", () => {
        expect(formatMessage({ message: "Costs $$5 (30 s)" })).toBe("Costs $5 (30 s)");
    });

    it("uses an empty string for missing substitutions and unknown placeholders", () => {
        const entry = { message: "[$A$] [$B$]", placeholders: { a: { content: "$2" } } };
        expect(formatMessage(entry, "only one")).toBe("[] []");
    });
});

describe("t", () => {
    afterEach(() => {
        setLanguage("auto", "en-US");
    });

    it("follows the browser language when the setting is automatic", () => {
        expect(setLanguage("auto", "pt-BR")).toBe("pt_BR");
        expect(t("copy")).toBe("Copiar");
        expect(setLanguage("auto", "ja-JP")).toBe("ja");
        expect(t("copy")).toBe("コピー");
    });

    it("lets an explicit language override the browser", () => {
        expect(setLanguage("de", "pt-BR")).toBe("de");
        expect(t("copy")).toBe("Kopieren");
    });

    it("ignores a language it does not know and follows the browser instead", () => {
        expect(setLanguage("klingon", "fr")).toBe("fr");
        expect(t("copy")).toBe("Copier");
    });

    it("fills placeholders in the active language", () => {
        setLanguage("es", "en");
        expect(t("statusCopiedClearIn", "30")).toBe("Copiada. El portapapeles se borrará en 30 s.");
        expect(t("errorInvalidLength", ["4", "128"])).toBe("La longitud debe estar entre 4 y 128.");
    });

    it("reports the tag and the reading direction of the active language", () => {
        setLanguage("ar", "en");
        expect(languageTag()).toBe("ar");
        expect(textDirection()).toBe("rtl");
        setLanguage("pt_BR", "en");
        expect(languageTag()).toBe("pt-BR");
        expect(textDirection()).toBe("ltr");
    });
});

describe("message usage", () => {
    const sources = [
        // The helper's own documentation contains example markup such as data-i18n="key".
        ...listFiles(path.join(ROOT, "src"), [".ts"]).filter((file) => !file.endsWith("i18n.ts")),
        ...listFiles(path.join(ROOT, "public"), [".html", ".json"]),
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
});
