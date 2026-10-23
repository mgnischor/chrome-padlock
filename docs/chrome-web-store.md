# Chrome Web Store: Privacy practices answers

Text to paste into the **Privacy practices** tab of the Chrome Web Store developer dashboard.
Every statement below was checked against the source code (permissions in `public/manifest.json`).
If a feature or permission changes, update the matching answer, because reviewers compare them.

## Single purpose description

> Padlock generates strong, random passwords on the user's device using the browser's cryptographically secure random number generator, and lets the user copy a generated password or insert it into a text field. Every feature supports that one purpose: the generator options, the strength meter, the optional clipboard auto-clear after copying, and the optional history of recently generated passwords.

## Permission justifications

### storage

> Saves the user's generator preferences (length, character types, excluded characters, clipboard-clear delay, and whether the history is enabled) in chrome.storage.sync so they persist between sessions. It also uses chrome.storage.session, which is held in memory only and never written to disk, for two short-lived items: the optional history of the last 50 generated passwords and a SHA-256 hash of a just-copied password used by the clipboard auto-clear. Nothing is sent to any server.

### contextMenus

> Adds a single entry, "Insert secure password", to the right-click menu of editable text fields. When the user selects it, Padlock generates a password and inserts it into that field. It is the only context menu item the extension adds.

### scripting

> Used only through chrome.scripting.executeScript, once, when the user clicks the "Insert secure password" menu item. It runs a small self-contained function in the frame the user right-clicked, which writes the generated password into the focused text field and fires input/change events so the page registers the value. The extension declares no content scripts, injects nothing at any other time, and never reads or sends page content.

### activeTab

> Gives temporary access to the current tab only after the user clicks the "Insert secure password" menu item, which is what allows the scripting permission to insert the password into the field they right-clicked. Because of activeTab, the extension requests no host permissions and has no access to any site in the background.

### alarms

> Used only by the optional "Clear clipboard after copying" feature. The popup closes as soon as it loses focus, so the service worker sets a single alarm (30 seconds to 2 minutes, chosen by the user) to clear the clipboard later. The extension has no periodic or other background tasks.

### offscreen

> A service worker has no DOM and cannot access the clipboard. For the optional clipboard auto-clear, the extension creates an offscreen document (reason: CLIPBOARD) only when the alarm fires. The document checks whether the clipboard still holds the copied password, clears it if so, and is closed immediately afterwards. It is never created unless the user turned the feature on.

### clipboardRead (optional permission)

> Optional: requested at runtime only when the user turns on "Clear clipboard after copying". It is used only when the timer fires, to compare a SHA-256 hash of the clipboard with the hash of the password Padlock copied, so that the clipboard is cleared only if it still holds that password and anything the user copied since is left untouched. Clipboard contents are never stored or transmitted.

### clipboardWrite (optional permission)

> Optional: requested together with clipboardRead when the user turns on "Clear clipboard after copying". It is used only to overwrite the clipboard with a blank value after the chosen delay, once the check described above confirms it still contains the generated password. The Copy button itself does not use this permission; it relies on the user's click.

## Other fields

| Field                             | Answer                                                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Host permission justification     | Not applicable. The extension requests no host permissions.                                                                                         |
| Are you using remote code?        | No. All JavaScript is packaged in the extension (Manifest V3, `script-src 'self'`). It never loads or evaluates code from the network.             |
| Data usage: data types collected  | Leave every box unchecked. The extension does not collect user data: nothing leaves the device, and there is no analytics, telemetry or server.    |
| Data usage: certifications        | Check all three: data is not sold, not used for unrelated purposes, and not used for creditworthiness or lending.                                   |
| Privacy policy URL                | Recommended even though no data is collected, because the extension handles passwords and the clipboard. See the notes below.                       |

### Notes

- The dashboard treats data as "collected" only when it is transmitted off the user's device. Padlock
  processes generated passwords, settings and the clipboard hash locally, so none of the data-type
  boxes apply.
- `chrome.storage.sync` is Chrome's own sync of the user's preferences. Preferences contain no
  passwords.
- Permission justifications are limited to roughly 1,000 characters each; every answer above is well
  under that.
- The store listing description and screenshots should mention the same features (right-click
  insertion, optional clipboard auto-clear, optional history) so they match these answers.
