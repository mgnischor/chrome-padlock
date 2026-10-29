# Padlock – Secure Password Generator

**English** · [Português (Brasil)](README.pt-BR.md) · [Español](README.es-ES.md)

A Chrome (Manifest V3) extension, written in TypeScript, that generates strong random passwords
entirely on your device.

## Features

- **Cryptographically secure randomness** – every character comes from `crypto.getRandomValues`;
  `Math.random` is never used.
- **No modulo bias** – random integers use rejection sampling (`src/core/random.ts`).
- **Uniform output** – passwords are sampled uniformly from all strings that contain at least one
  character of every selected class (rejection sampling, not "insert one of each and shuffle"), so
  there is no positional bias.
- **Exact entropy** – the strength meter shows the true entropy in bits, computed with
  inclusion–exclusion over the selected classes (`src/core/entropy.ts`).
- **Options** – length 4–128, lowercase / uppercase / digits / symbols, optional removal of
  look-alike characters (`0 O 1 l I |`), and a custom list of excluded characters.
- **Insert into a page** – right-click any text field and choose _Insert secure password_.
- **Clipboard auto-clear** (optional) – clears the clipboard 30 s – 2 min after copying, but only if
  it still contains the copied password.
- **Password history** (optional, off by default) – when enabled in the popup, a _History_ button
  shows the last 50 generated passwords, newest first, each with a timestamp and a copy button.
  See [History](#history) for what is recorded and where it lives.
- **Roomy popup** that uses the full 640 × 400 px an extension popup can have: the password and its
  strength on the left, all options on the right, with no scrolling in the generator view.
- **Localized in 30 languages**, the most spoken native languages plus Polish: English, Chinese
  (Simplified and Traditional), Spanish, Hindi, Bengali, Portuguese (Brazil), Russian, Japanese,
  Punjabi, Marathi, Telugu, Turkish, Korean, French, German, Vietnamese, Tamil, Urdu, Javanese,
  Italian, Arabic, Gujarati, Persian, Bhojpuri, Hausa, Kannada, Indonesian, Polish, Malayalam and
  Ukrainian. The extension follows the browser's language automatically, or you can pick one in the
  settings. Arabic, Persian and Urdu switch the layout to right-to-left. See
  [Localization](#localization).
- **Password strength test** (shield button, next to the gear): type or paste any password to see
  its estimated entropy in bits, a strength rating, warnings about easy patterns, and how long it
  would take to crack under four kinds of attack, from a rate-limited web login to an offline attack
  on a fast hash with GPUs. The password is analyzed on your device and is never stored or sent, and
  the field is emptied as soon as you leave the screen. See [Strength test](#strength-test).
- **Settings screen** (gear button): language, light / dark / system theme, clipboard auto-clear, the
  password history, the right-click menu entry, and blurring passwords until you hover over them. One
  button restores the defaults.
- **About screen** (GitHub button): version, author, license, privacy statement and a link to the
  [source code on GitHub](https://github.com/mgnischor/chrome-padlock).
- Keyboard accessible, no network access, no analytics.
- Open the popup with `Ctrl+Shift+Y` (`Command+Shift+Y` on macOS); rebind it at
  `chrome://extensions/shortcuts`.

## Install (from source)

Requires Node.js 20.12 or newer.

```bash
npm install
npm run build
```

Then open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and select the
`dist/` folder.

## Development

| Command             | Purpose                                                        |
| ------------------- | -------------------------------------------------------------- |
| `npm run build`     | Production build into `dist/`: JS, HTML, CSS and JSON minified |
| `npm run package`   | Build, verify and zip into `release/padlock-<version>.zip`     |
| `npm run watch`     | Rebuild on change (unminified, inline source maps)             |
| `npm run typecheck` | Run `tsc --noEmit` in strict mode                              |
| `npm test`          | Run the unit tests (Vitest)                                    |
| `npm run icons`     | Regenerate `public/icons/*.png` (dependency-free generator)    |
| `npm run check`     | Typecheck, test and build                                      |

After a rebuild, press the reload button on the extension's card in `chrome://extensions`.

### Project layout

```
public/                 Static files copied to dist/ (manifest, HTML, CSS, icons)
src/locales/            Translations, one JSON file per language (en_US is the source)
scripts/                Build tooling: build, package, minify, zip and icon generator
src/core/               Pure, DOM-free logic: random, charsets, generator, entropy, strength test
src/shared/             Settings, history, i18n helper, message types, hashing helper
src/popup/              Popup UI
src/background/         Service worker: context menu, clipboard-clear timer
src/offscreen/          Offscreen document that performs the clipboard clear
tests/                  Vitest unit tests for core/, settings, history and locales
```

## Design notes

### Why rejection sampling for the whole password?

The common "pick one character from each class, fill the rest, then shuffle" approach produces a
distribution that is not uniform over valid passwords, which makes the real entropy hard to state.
Padlock instead draws every position uniformly from the combined pool and retries if a selected
class is missing. The result is exactly uniform over the valid strings, and the entropy is
`log2(N)` with `N` computed exactly. The retry cost is negligible (about one attempt for normal
lengths; roughly a hundred cheap attempts in the worst case of length 4).

### Permissions

| Permission                                     | Why                                                          |
| ---------------------------------------------- | ------------------------------------------------------------ |
| `storage`                                      | Remember your options, and hold the opt-in history in memory |
| `contextMenus`, `scripting`, `activeTab`       | "Insert secure password" on the field you right-click        |
| `alarms`, `offscreen`                          | Timer and helper document for clipboard auto-clear           |
| `clipboardRead`, `clipboardWrite` _(optional)_ | Requested only when you enable clipboard auto-clear          |

No host permissions are requested. `activeTab` only grants access to the tab you invoke the context
menu on, for that one action.

### Clipboard auto-clear

The popup closes as soon as it loses focus, so the timer runs in the service worker. The worker
stores only a SHA-256 hash of the copied password in `chrome.storage.session` (memory only, never
written to disk). When the alarm fires, an offscreen document reads the clipboard, compares its
hash and overwrites it only on a match. Chrome limits alarms to a 30 second minimum. If the user
copied something else in the meantime, the clipboard is left untouched.

### History

Off by default. Enable it with _Keep a history of the last 50 passwords_ in the popup.

- **What is recorded:** the password shown when the popup opens, after _Regenerate_, and after an
  option is changed. While a slider is dragged or the exclusion field is typed in, only the final
  password is recorded, not every intermediate one. Passwords inserted through the right-click menu
  are recorded too. Consecutive duplicates are ignored, and only the newest 50 are kept.
- **Where it lives:** `chrome.storage.session`, i.e. browser memory only. It is never written to
  disk and is erased when Chrome closes. The passwords are stored **unencrypted** while Chrome runs,
  so anyone who can inspect the extension while your browser session is open could read them.
- **Removal:** _Clear history_ deletes every entry, and turning the option off deletes the history.
- **Persistence:** to keep the history across browser restarts, change `storageArea` in
  `src/shared/history.ts` to `chrome.storage.local`. That writes plain-text passwords to your
  profile on disk, which is why it is not the default.

### Privacy

Passwords are generated in memory, shown in the popup, and discarded when it closes, unless you
enable the history (see above). Only your settings are persisted (via `chrome.storage.sync`, so they
follow your Chrome profile): the generator options, language, theme and the other switches. The
extension makes no network requests. The only link it contains, to the project's GitHub page on the
About screen, opens in a new tab and only if you click it.

### Localization

The popup and the right-click menu are translated into 30 languages. By default the language follows
the browser's UI language, and the settings let you choose another one, which `chrome.i18n` cannot do.
For that reason the translations are bundled into the extension and looked up by
`src/shared/i18n.ts`, using the same message format as Chrome (`$1` and `$NAME$` placeholders).
Browser languages are matched to the closest translation: `pt-PT` uses Brazilian Portuguese,
`es-419` uses Spanish, `zh-TW`/`zh-HK` use Traditional Chinese, any other Chinese uses Simplified, and
everything else falls back to English.

- **Messages** live in `src/locales/<code>.json`, in the format of Chrome's `messages.json`. English
  (`en_US`) is the source; the other files must define the same keys and placeholders.
- **Chrome's own strings** (name, description, toolbar tooltip, shortcut label) come from `_locales`.
  The build generates those folders from `src/locales`, but only for the 26 languages Chrome supports.
  Punjabi, Urdu, Javanese, Bhojpuri and Hausa have no Chrome UI language, so the store listing and
  Chrome's extension page show English for them. The extension itself is fully translated.
- **Popup text** is localized at startup, and again whenever the language changes, by
  `applyTranslations`. The HTML keeps its English text as a fallback and marks translatable elements
  with `data-i18n="key"`, `data-i18n-title`, `data-i18n-aria-label` or `data-i18n-placeholder`.
  Messages built in code use `t("key", substitutions)`. Keys are type-checked against `en_US.json`,
  and `src/shared/catalog.ts` is typed so that a language missing a message fails to compile.
- **The core stays language-neutral:** the generator reports error _codes_ and the entropy module
  reports strength _levels_; the popup maps both to localized text.
- **Right-to-left languages** (Arabic, Persian, Urdu) set `dir="rtl"` on the page. Passwords, character
  hints and number fields always stay left-to-right.
- **Dates** in the history use the active language.
- **Adding a language:** copy `src/locales/en_US.json` to `src/locales/<code>.json` and translate every
  `message` (keep the `placeholders` blocks as they are); add one entry to `LOCALES` in
  `src/shared/locales.ts` (code, name in that language, language tag, direction); add the import and the
  entry to `src/shared/catalog.ts`. If Chrome supports the language as a UI language, also add its code
  to `MANIFEST_LOCALES` in `scripts/manifest-locales.mjs`. The tests then check that the new file has the
  same keys and placeholders as English, that it is translated and not a copy, that no message is unused
  and that the description stays within the Web Store limit of 132 characters.
- **Testing a language:** pick it in the settings, or start Chrome with `--lang=pt-BR` to test the
  automatic choice.

### Strength test

The test works on any password, not only the ones Padlock creates, so it cannot assume the password
is random. `analyzePassword` (`src/core/strength.ts`) splits the password into pieces and prices each
one in bits of guessing effort, the way an attacker would try it, then keeps the cheapest split:

| Piece                                              | Price                                             |
| -------------------------------------------------- | ------------------------------------------------- |
| A common password or word (about 160 built in)     | `log2(rank)`, plus a bit for capitals or look-alikes (`P@ssw0rd`) |
| A repeat (`aaaa`, `abcabc`)                        | the repeated unit, plus `log2(times)`             |
| A sequence (`abcd`, `4321`) or keyboard run (`asdf`) | a starting point plus `log2(length)`            |
| A year from 1900 to 2039                           | about 8 bits                                      |
| Anything else                                      | `log2(pool)` per character, the pool being the character types used |

For a random password this equals `length × log2(pool)`; for a chosen one it is lower, often far
lower. The crack time is the average, which is half of all guesses, `2^(bits − 1)`, divided by the
guess rate. The four rates are the ones the zxcvbn estimator uses: 100 per hour (a throttled web
login), 10 per second (an unthrottled one), 10 thousand per second (an offline attack on a slow
hash such as bcrypt) and 10 billion per second (an offline attack on a fast hash such as MD5, with
GPUs). Durations are written by `Intl.NumberFormat` (`src/shared/format.ts`), so units and plurals
come from the browser's locale data in every language.

Limits, which the screen also states: it is an **estimate**. It knows only the patterns above and a
short list of common passwords, so a password made of ordinary words (a passphrase such as "correct
horse battery staple") is rated higher than it deserves, because there is no dictionary. It cannot know
whether a password has appeared in a breach. A rating of "very strong" therefore means "no easy
pattern found", not "safe to use": use a password nobody has ever seen, such as one Padlock generates.

The typed password never leaves the page: it is not stored, not sent in a message, not added to the
history and not logged, and the field is cleared when you leave the screen or press Escape.

### Appearance and settings

The theme setting is _System default_, _Light_ or _Dark_. It is applied through a `data-theme`
attribute on the page, so the colors are plain CSS custom properties in `public/popup.css`. The popup
stays hidden until the saved language and theme are applied, so neither flashes on opening. Settings
are validated when read (`sanitizeSettings`), so an unknown language or theme in storage falls back to
the defaults instead of breaking the popup.

### Code documentation

Every function is documented with [TSDoc](https://tsdoc.org): a one-line summary, then
`@param name - description`, `@returns` and `@throws` where they apply. Types are not repeated in the
tags because TypeScript already provides them.

### Build and packaging

`npm run build` always produces the production build that is shipped. Only `npm run watch` skips
minification, so that errors point at readable code.

| File type                      | How it is minified                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript → JavaScript        | esbuild: bundled, minified, no source maps, license comments removed                                                                  |
| `popup.css`                    | esbuild's CSS minifier                                                                                                                |
| `popup.html`, `offscreen.html` | `scripts/minify.mjs`: comments removed and whitespace collapsed; quoted attributes and `<script>`/`<textarea>` contents are untouched |
| `manifest.json`                | Compact JSON, with the version taken from `package.json`                                                                              |
| `src/locales/*.json`           | Bundled into the JavaScript without the translator-only `description` and `example` notes, as UTF-8 rather than `\u` escapes         |
| `_locales/*/messages.json`     | Generated: only the five manifest messages, compact JSON, for the 26 languages Chrome supports                                        |
| Icons                          | Copied as they are                                                                                                                    |

`npm run package` then verifies the build and writes the Web Store upload to
`release/padlock-<version>.zip` (reproducible: the same sources give the same bytes). It stops with an
error if the manifest references a missing file, if source maps or other development files slipped in,
if an HTML page has an inline script, or if the bundled JavaScript contains `fetch`, `XMLHttpRequest`,
`WebSocket`, `eval`, `new Function` or an `http(s)://` URL.

### Security

- **No network, by construction.** The content security policy blocks every request
  (`connect-src 'none'`), plugins, base-URL changes and form posts, and allows only scripts packaged
  with the extension. The package check above rejects network and `eval` code.
- **No site access.** The manifest declares no host permissions, content scripts or web-accessible
  resources. `activeTab` gives access to one tab only after the user clicks the context menu item.
- **Strict message handling.** The service worker accepts runtime messages only from this extension,
  and validates their shape, hash format and delay against the values the UI offers.
- **Memory-only secrets.** The history and the clipboard hash live in `chrome.storage.session`, limited
  to trusted extension contexts and never written to disk.
- **Safe DOM updates.** The code never uses `innerHTML`; text goes in with `textContent`.
- **Guard tests.** `tests/manifest.test.ts` fails if a permission is added without a matching
  justification in `docs/chrome-web-store.md`, or if the manifest gains host access or a weaker policy.
- **Dependencies.** `npm audit` reports no known vulnerabilities, and the extension ships no runtime
  dependencies: everything bundled into the package is this repository's own code.

### Publishing

- [docs/privacy-policy.md](docs/privacy-policy.md): the privacy policy. The store needs it at a public
  URL. Update it before releasing any change to what the extension stores or transmits.
- [store-listing/](store-listing): the store description, ready to paste, in the 26 languages the
  store accepts for a listing (one `<code>.txt` per language). Each text follows the store's listing
  rules: no emoji or decorative symbols, no keyword repeated more than five times, only claims that
  match what the extension does, and no link except the project's repository. `tests/store-listing.test.ts`
  checks all of this, so edit the texts and run `npm test` before pasting a changed one.

## Limitations

- Random character passwords only; there is no passphrase mode.
- "Insert secure password" fills the focused field only. It does not fill a "confirm password"
  field; copy the password and paste it there.
- The extension is not a password manager. The optional history is a short-lived convenience, not
  storage; save important passwords in a password manager.
