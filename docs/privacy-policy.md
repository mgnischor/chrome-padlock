# Padlock Privacy Policy

**Effective date:** October 23, 2026

Padlock is a Chrome extension that generates strong, random passwords on your device. This policy
explains what the extension does with your information.

## Summary

- Padlock **does not collect, transmit, sell or share any personal data**.
- Everything happens locally in your browser. The extension has no server, no account system, no
  analytics and no tracking, and it makes no network requests.
- Generated passwords are shown to you and discarded when you close the popup, unless you turn on the
  optional history, which is kept in browser memory only.

## What Padlock does

Padlock generates passwords with your browser's cryptographically secure random number generator. You
can copy a password from the popup, or right-click a text field and choose **Insert secure password**
to have Padlock write one into that field.

## Information we collect

None. The developer never receives any information from the extension: no passwords, no browsing
activity, no page content, no clipboard content, no device or usage data.

## Information stored on your device

| Information                                                                                                            | Where it is stored                                                   | Purpose                                                         |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------- |
| Your preferences (length, character types, excluded characters, language, theme, clipboard-clear delay, and the on/off switches of the history, the right-click menu entry and password blurring) | `chrome.storage.sync`                                                | Remember your settings between sessions. Contains no passwords. |
| Recently generated passwords (last 50), **only if you enable the history**                                             | `chrome.storage.session`: browser memory only, never written to disk | Let you view passwords you generated earlier.                   |
| A SHA-256 hash of the last copied password, **only if you enable clipboard auto-clear**                                | `chrome.storage.session`: browser memory only                        | Clear the clipboard only if it still holds that password.       |

Details:

- **Preferences and Chrome Sync.** `chrome.storage.sync` is a feature of Chrome. If you are signed in to
  Chrome with sync enabled, Chrome may sync these preferences across your devices through your Google
  account. That is handled by Google under its own privacy policy; the developer has no access to it.
- **Password history.** It is off by default. When on, the passwords are kept unencrypted in browser
  memory and are erased when Chrome closes. Turning the option off, or choosing **Clear history**,
  deletes them immediately.
- **Passwords you do not save.** With the history off, a generated password exists only while the
  popup is open (or for the instant it takes to insert it into a field).

## Clipboard

When you press **Copy**, Padlock writes the password to your clipboard. This uses your click and needs
no special permission.

If you turn on **Clear clipboard after copying**, Padlock asks for the optional clipboard permissions.
After the delay you chose, it reads the clipboard once, compares a hash of it with the hash of the
password it copied, and overwrites the clipboard with a blank value only if they match. Anything else
you copied in the meantime is left untouched. The clipboard content is never stored, logged or
transmitted. You can revoke these permissions at any time in `chrome://extensions`.

## Web page content

Padlock does not read, collect or transmit the content of the pages you visit. When you choose
**Insert secure password**, it temporarily gains access to that one tab (through Chrome's `activeTab`
permission) and writes the generated password into the field you right-clicked. It requests no
permission to access websites in the background.

## The link to GitHub

The **About** screen of the popup contains a link to the project's public page on GitHub
(`github.com/mgnischor/chrome-padlock`). Padlock itself never contacts that address: the link opens in
a new browser tab only if you click it, and from then on you are using GitHub under its own privacy
policy.

## Permissions

| Permission                                   | Why Padlock needs it                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| `storage`                                    | Save your preferences, and hold the optional history and clipboard hash in memory. |
| `contextMenus`                               | Add the **Insert secure password** item to the right-click menu of text fields.    |
| `scripting`, `activeTab`                     | Insert the generated password into the field you right-clicked.                    |
| `alarms`, `offscreen`                        | Run the optional clipboard auto-clear after the delay you chose.                   |
| `clipboardRead`, `clipboardWrite` (optional) | Check and clear the clipboard for the optional auto-clear feature.                 |

## Third parties

Padlock does not use third-party services, SDKs, advertising or analytics, and it does not sell or
share data with anyone. Its use of information complies with the
[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq),
including the Limited Use requirements.

## Security

Passwords are generated with the Web Crypto API (`crypto.getRandomValues`). Because the extension never
sends data off your device, there is nothing for the developer to store or leak. You remain responsible
for keeping your device and browser profile secure and for saving important passwords in a password
manager.

## Children's privacy

Padlock is a general-purpose utility and is not directed at children. It does not knowingly collect
information from anyone.

## Changes to this policy

If the extension's data practices change (for example, if a future version stores history on disk or
connects to a service), this policy will be updated before that version is released, and the effective
date above will change.

## Contact

Questions about this policy: Miguel Nischor, [miguel@nischor.com.br](mailto:miguel@nischor.com.br).
