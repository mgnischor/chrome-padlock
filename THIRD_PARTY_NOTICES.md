# Third-party notices

Padlock's code is licensed under the Apache License 2.0 (see [LICENSE.md](LICENSE.md)). The package
also contains word lists, used as data, that are the work of others. Each is listed here with its
source and license. No other third-party code or data is bundled into the extension.

## EFF Large Wordlist for Passphrases

- **Where it is used:** `src/core/wordlist.ts`. It is the list Padlock draws passphrase words from, and
  one of the lists the strength test looks words up in.
- **Source:** Electronic Frontier Foundation,
  [New Wordlists for Random Passphrases](https://www.eff.org/deeplinks/2016/07/new-wordlists-random-passphrases)
  (2016).
- **License:** [Creative Commons Attribution 3.0 United States](https://creativecommons.org/licenses/by/3.0/us/).
- **Changes:** the dice numbers were removed and the words are stored in a single string. The words
  themselves are unchanged.

## Common passwords

- **Where it is used:** `src/core/dictionary.ts`, through the `@zxcvbn-ts/language-common` package
  (`passwords.json`), to recognize passwords that turn up again and again in leaks.
- **Source:** Mark Burnett's
  [ten million passwords release](https://medium.com/xato-security/today-i-am-releasing-ten-million-passwords-b6278bbe7495).
- **License:** public domain, as stated by the author in the release article. As the package notes, no
  position is taken here on the legal effect of that dedication in every jurisdiction.

## Common English words

- **Where it is used:** `src/core/dictionary.ts`, through the `@zxcvbn-ts/language-en` package
  (`commonWords.json`), to recognize ordinary words in a password.
- **Source:** OpenSubtitles 2024, provided by Helsinki-NLP through [OPUS](https://opus.nlpl.eu/).
- **License:** [ODC-BY](https://opendatacommons.org/licenses/by/) (Open Data Commons Attribution License).
- **Notice, as kept from the package:** this data is derived from OpenSubtitles via OPUS. Original data
  is attributed to subtitle contributors and rights holders. The package contains a processed
  derivative: tokenized text, frequency aggregation, normalization and filtering.

## The packages that carry the last two lists

The two lists above reach Padlock through `@zxcvbn-ts/language-common` and `@zxcvbn-ts/language-en`
(and their dependency `@zxcvbn-ts/dictionary-compression`), part of the
[zxcvbn-ts](https://github.com/zxcvbn-ts/zxcvbn) project, licensed under the MIT License. They are
development dependencies, pinned to exact versions in `package.json`, and their data is bundled into
`popup.js` when the extension is built. Padlock uses only their data, not the zxcvbn estimator.
