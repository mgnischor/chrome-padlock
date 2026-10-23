# Padlock – Secure Password Generator

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
- **Localized** in English (US), Brazilian Portuguese and Spanish. The extension follows the
  browser's UI language automatically; any other language falls back to English. See
  [Localization](#localization).
- **Light / dark theme**, keyboard accessible, no network access, no analytics.
- Open the popup with `Ctrl+Shift+Y` (`Command+Shift+Y` on macOS); rebind it at
  `chrome://extensions/shortcuts`.

## Install (from source)

Requires Node.js 18+.

```bash
npm install
npm run build
```

Then open `chrome://extensions`, enable **Developer mode**, click **Load unpacked** and select the
`dist/` folder.

## Development

| Command             | Purpose                                                     |
| ------------------- | ----------------------------------------------------------- |
| `npm run build`     | Bundle the extension into `dist/` (minified)                |
| `npm run watch`     | Rebuild on change (unminified, inline source maps)          |
| `npm run typecheck` | Run `tsc --noEmit` in strict mode                           |
| `npm test`          | Run the unit tests (Vitest)                                 |
| `npm run icons`     | Regenerate `public/icons/*.png` (dependency-free generator) |
| `npm run check`     | Typecheck, test and build                                   |

After a rebuild, press the reload button on the extension's card in `chrome://extensions`.

### Project layout

```
public/                 Static files copied to dist/ (manifest, HTML, CSS, icons)
public/_locales/        Translations: en_US (default), pt_BR and es
scripts/                build.mjs (esbuild) and make-icons.mjs
src/core/               Pure, DOM-free logic: random, charsets, generator, entropy
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
enable the history (see above). Only your option choices are persisted (via `chrome.storage.sync`,
so they follow your Chrome profile). The extension makes no network requests.

### Localization

The extension uses Chrome's built-in `chrome.i18n` system, so the language always follows the
browser's UI language and needs no setting. Chrome picks the best match: an exact locale such as
`pt_BR`, then the base language such as `es`, then the default locale `en_US`.

- **Messages** live in `public/_locales/<locale>/messages.json`. The manifest (name, description,
  toolbar tooltip, shortcut description) uses `__MSG_<key>__` references.
- **Popup text** is localized at startup by `applyTranslations` in `src/shared/i18n.ts`. The HTML keeps
  its English text as a fallback and marks translatable elements with `data-i18n="key"`,
  `data-i18n-title`, `data-i18n-aria-label` or `data-i18n-placeholder`. Messages built in code use
  `t("key", substitutions)`. Message keys are type-checked against `en_US/messages.json`.
- **The core stays language-neutral:** the generator reports error *codes* and the entropy module
  reports strength *levels*; the popup maps both to localized text.
- **Dates** in the history use the browser's UI language.
- **Adding a language:** copy `public/_locales/en_US` to a new folder named after the locale (for
  example `fr` or `de`), translate every `message`, and keep the `placeholders` blocks unchanged. Then
  add the folder name to `EXPECTED_LOCALES` in `tests/i18n.test.ts`. The tests check that every locale
  has the same keys and placeholders as `en_US`, that no message is unused, and that the extension
  description stays within the Web Store limit of 132 characters.
- **Testing a language:** start Chrome with `--lang=pt-BR` (or change the language in
  `chrome://settings/languages` and restart Chrome), then reload the extension.

### Code documentation

Every function is documented with [TSDoc](https://tsdoc.org): a one-line summary, then
`@param name - description`, `@returns` and `@throws` where they apply. Types are not repeated in the
tags because TypeScript already provides them.

### Publishing

- [docs/chrome-web-store.md](docs/chrome-web-store.md): answers for the Chrome Web Store *Privacy
  practices* tab (single purpose and permission justifications).
- [docs/privacy-policy.md](docs/privacy-policy.md): the privacy policy. The store needs it at a public
  URL. Update it before releasing any change to what the extension stores or transmits.

## Limitations

- Random character passwords only; there is no passphrase mode.
- "Insert secure password" fills the focused field only. It does not fill a "confirm password"
  field; copy the password and paste it there.
- The extension is not a password manager. The optional history is a short-lived convenience, not
  storage; save important passwords in a password manager.
