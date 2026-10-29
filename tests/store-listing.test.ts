/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/store-listing.test.ts
    Description: Checks the Chrome Web Store descriptions against the store's listing rules and the extension's behavior.
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
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MANIFEST_LOCALES } from "../scripts/manifest-locales.mjs";
import { HISTORY_LIMIT } from "../src/shared/history";
import { CLIPBOARD_CLEAR_CHOICES } from "../src/shared/settings";
import { LOCALES } from "../src/shared/locales";
import { MAX_LENGTH, MIN_LENGTH } from "../src/core/generator";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LISTING_DIR = path.join(ROOT, "store-listing");
const REPOSITORY = "github.com/mgnischor/chrome-padlock";

/** The store limits a description to 16,000 characters. */
const MAX_DESCRIPTION = 16_000;

/**
 * The stem of the word for "password" in each language. The store treats the same keyword repeated
 * more than 5 times as keyword spam, so each description must stay below that.
 */
const PASSWORD_STEMS: Record<string, RegExp> = {
    ar: /مرور/g,
    bn: /পাসওয়ার্ড/g,
    de: /passw/gi,
    en_US: /password/gi,
    es: /contraseña/gi,
    fa: /گذرواژه/g,
    fr: /mots? de passe/gi,
    gu: /પાસવર્ડ/g,
    hi: /पासवर्ड/g,
    id: /kata sandi/gi,
    it: /password/gi,
    ja: /パスワード/g,
    kn: /ಪಾಸ್/g,
    ko: /비밀번호/g,
    ml: /പാസ്/g,
    mr: /पासवर्ड/g,
    pl: /hasł|hasło|haseł/gi,
    pt_BR: /senha/gi,
    ru: /парол/gi,
    ta: /கடவுச்/g,
    te: /పాస్/g,
    tr: /parola/gi,
    uk: /парол/gi,
    vi: /mật khẩu/gi,
    zh_CN: /密码/g,
    zh_TW: /密碼/g,
};

/**
 * Grammar words that happen to be five or more letters long: "and" in Kannada and Telugu (five code
 * points each) and "not" in Vietnamese. They are not keywords, which is what the store's rule is about.
 */
const FUNCTION_WORDS = new Set(["ಮತ್ತು", "మరియు", "không"]);

const present = existsSync(LISTING_DIR);

/**
 * Reads the description for one language.
 *
 * @param code - Language code such as `pt_BR`.
 * @returns The text to paste into the store's description field.
 */
function listing(code: string): string {
    return readFileSync(path.join(LISTING_DIR, `${code}.txt`), "utf8");
}

/**
 * Reads the name of the right-click menu entry in a language.
 *
 * @param code - Language code.
 * @returns The text of the `menuInsertPassword` message.
 */
function menuEntry(code: string): string {
    const messages = JSON.parse(readFileSync(path.join(ROOT, "src", "locales", `${code}.json`), "utf8"));
    return messages.menuInsertPassword.message;
}

describe.skipIf(!present)("store descriptions", () => {
    it("exist for exactly the languages the store accepts for the listing", () => {
        const files = readdirSync(LISTING_DIR).filter((file) => file.endsWith(".txt"));
        expect(files.map((file) => file.replace(/\.txt$/, "")).sort()).toEqual([...MANIFEST_LOCALES].sort());
    });

    it("have a keyword-repetition rule for every language", () => {
        expect(Object.keys(PASSWORD_STEMS).sort()).toEqual([...MANIFEST_LOCALES].sort());
    });

    it.each(MANIFEST_LOCALES)("%s is a complete, sensibly sized description", (code) => {
        const text = listing(code);
        expect(text.length).toBeGreaterThan(400);
        expect(text.length).toBeLessThanOrEqual(MAX_DESCRIPTION);
        // Intro, how it works, privacy, permissions and the open-source line.
        expect(text.trim().split(/\n\s*\n/)).toHaveLength(5);
        expect(text.split("\n").filter((line) => line.startsWith("- "))).toHaveLength(6);
        expect(text.endsWith("\n")).toBe(true);
    });

    it.each(MANIFEST_LOCALES)("%s has no emoji, pictograph or decorative symbol", (code) => {
        // U+200D (zero width joiner) is deliberately allowed: Bengali and Marathi spell some words with it.
        expect(listing(code)).not.toMatch(/\p{Extended_Pictographic}|️|[★☆✓✔✨❤→←▶►■□●○◆◇]/u);
    });

    it.each(MANIFEST_LOCALES)("%s has no shouting in capital letters", (code) => {
        // Acronyms such as CSPRNG are fine; whole capitalized words of five or more letters are not.
        expect(listing(code)).not.toMatch(/\b\p{Lu}{5,}\b/u);
    });

    it.each(MANIFEST_LOCALES)("%s names the product but does not repeat it as a keyword", (code) => {
        const mentions = listing(code).match(/Padlock/g) ?? [];
        expect(mentions.length).toBeGreaterThanOrEqual(1);
        expect(mentions.length).toBeLessThanOrEqual(4);
    });

    it.each(MANIFEST_LOCALES)("%s repeats no keyword more than five times", (code) => {
        const text = listing(code);
        const stem = PASSWORD_STEMS[code]!;
        expect((text.match(stem) ?? []).length, "the word for password").toBeLessThanOrEqual(5);

        // And no other word of five or more letters comes back more than five times either.
        const counts = new Map<string, number>();
        for (const word of text.toLowerCase().match(/[\p{L}\p{M}]{5,}/gu) ?? []) {
            if (FUNCTION_WORDS.has(word)) continue;
            counts.set(word, (counts.get(word) ?? 0) + 1);
        }
        const repeated = [...counts].filter(([, count]) => count > 5);
        expect(repeated, "words repeated more than five times").toEqual([]);
    });

    it.each(MANIFEST_LOCALES)("%s links only to the project's repository", (code) => {
        const text = listing(code);
        expect(text.split(REPOSITORY)).toHaveLength(2);
        const withoutRepository = text.replace(REPOSITORY, "");
        expect(withoutRepository).not.toMatch(/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|org|net|io|dev|app|br|es|de)\b/i);
    });

    it.each(MANIFEST_LOCALES)("%s quotes the right-click entry exactly as the extension shows it", (code) => {
        expect(listing(code)).toContain(menuEntry(code));
    });

    it.each(MANIFEST_LOCALES)("%s states the numbers the extension really uses", (code) => {
        const text = listing(code);
        expect(text).toContain(String(MIN_LENGTH));
        expect(text).toContain(String(MAX_LENGTH));
        expect(text).toContain(String(HISTORY_LIMIT));
        expect(text).toContain(String(LOCALES.length - 1));
        const delays = CLIPBOARD_CLEAR_CHOICES.filter((delay) => delay > 0);
        expect(text).toContain(String(Math.min(...delays)));
    });

    it.each(MANIFEST_LOCALES.filter((code) => code !== "en_US"))("%s is translated, not the English text", (code) => {
        expect(listing(code)).not.toContain("Padlock creates");
        expect(listing(code)).not.toContain("How it works");
        expect(listing(code)).not.toBe(listing("en_US"));
    });

    it.each(MANIFEST_LOCALES)("%s keeps to what the extension does", (code) => {
        // Padlock is not a password manager and stores nothing, so the text must never promise otherwise.
        const text = listing(code);
        expect(text).not.toMatch(/credential|credencia|identifiant|Zugangsdaten|учётн/i);
    });
});
