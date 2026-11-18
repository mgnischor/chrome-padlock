/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/core/dictionary.ts
    Description: Lookup of common passwords and English words, priced in bits of guessing effort.
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
import commonPasswords from "@zxcvbn-ts/language-common/dist/passwords.json.mjs";
import commonWords from "@zxcvbn-ts/language-en/dist/commonWords.json.mjs";
import { WORDLIST } from "./wordlist";

/**
 * Three word lists tell the strength test what an attacker would try first:
 *
 * - about 49,000 passwords that turn up again and again in leaks, most common first
 *   (Mark Burnett's public domain collection, through the `@zxcvbn-ts/language-common` package);
 * - about 56,000 English words, most frequent first (OpenSubtitles, ODC-BY, through
 *   `@zxcvbn-ts/language-en`);
 * - the 7,776 words Padlock uses for passphrases, all equally likely.
 *
 * A word's price is `log2(rank + 1)`: a guesser that works down a list reaches the word at that rank.
 * A word that is on several lists costs the least of its prices.
 */

/** Which kind of list a match came from. */
export type DictionaryKind = "password" | "word";

/** A word found in the lists. */
export interface DictionaryMatch {
    /** Price in bits: how much guessing effort it takes to reach the word. */
    bits: number;
    /** `"password"` for the list of leaked passwords, `"word"` for ordinary words. */
    kind: DictionaryKind;
}

/** Longest entry looked up; longer pieces of a password are never tried against the lists. */
export const MAX_DICTIONARY_LENGTH = 32;

/** Price of a passphrase word: `log2` of the list size, since each word is equally likely. */
const PASSPHRASE_WORD_BITS = Math.log2(WORDLIST.length);

/** Rank (1 is the most common) of every entry of a list, by lower case text. */
type Ranks = Map<string, number>;

interface Tables {
    passwords: Ranks;
    words: Ranks;
    passphraseWords: ReadonlySet<string>;
}

let tables: Tables | undefined;

/**
 * Turns a list into a map from entry to rank, keeping the best rank of an entry that appears twice.
 *
 * @param list - Entries, most common first.
 * @returns The rank of each entry, in lower case, leaving out entries too long to be looked up.
 */
function rank(list: readonly string[]): Ranks {
    const ranks: Ranks = new Map();
    list.forEach((entry, index) => {
        const key = entry.toLowerCase();
        if (key.length <= MAX_DICTIONARY_LENGTH && !ranks.has(key)) ranks.set(key, index + 1);
    });
    return ranks;
}

/**
 * Builds the lookup tables on first use, so opening the popup does not pay for them.
 *
 * @returns The tables.
 */
function loadTables(): Tables {
    tables ??= { passwords: rank(commonPasswords), words: rank(commonWords), passphraseWords: new Set(WORDLIST) };
    return tables;
}

/**
 * Looks a piece of text up in the lists.
 *
 * @param text - Lower case text.
 * @returns How the text is priced, or `undefined` when it is on no list.
 */
export function lookupDictionary(text: string): DictionaryMatch | undefined {
    const { passwords, words, passphraseWords } = loadTables();
    const candidates: DictionaryMatch[] = [];

    const passwordRank = passwords.get(text);
    if (passwordRank !== undefined) candidates.push({ bits: Math.log2(passwordRank + 1), kind: "password" });
    const wordRank = words.get(text);
    if (wordRank !== undefined) candidates.push({ bits: Math.log2(wordRank + 1), kind: "word" });
    if (passphraseWords.has(text)) candidates.push({ bits: PASSPHRASE_WORD_BITS, kind: "word" });

    // The cheapest way in wins; on a tie the password list, which is the more telling one.
    return candidates.reduce<DictionaryMatch | undefined>(
        (best, candidate) => (best === undefined || candidate.bits < best.bits ? candidate : best),
        undefined
    );
}
