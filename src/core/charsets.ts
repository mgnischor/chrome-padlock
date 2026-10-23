/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/core/charsets.ts
    Description: Character classes and alphabets used by the password generator.
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
/** Character classes the generator can draw from. */
export type CharsetId = "lowercase" | "uppercase" | "digits" | "symbols";

/** Stable iteration order of the character classes. */
export const CHARSET_IDS: readonly CharsetId[] = ["lowercase", "uppercase", "digits", "symbols"];

/**
 * The raw alphabet of every class. Symbols deliberately leave out quotes,
 * backslash, backtick and space: those are the characters most often mangled
 * by shells, forms and copy/paste.
 */
export const CHARSETS: Readonly<Record<CharsetId, string>> = {
    lowercase: "abcdefghijklmnopqrstuvwxyz",
    uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    digits: "0123456789",
    symbols: "!@#$%^&*()-_=+[]{};:,.<>?/~",
};

/** Characters that are easily confused when read or typed by a human. */
export const AMBIGUOUS_CHARS = "0O1lI|";
