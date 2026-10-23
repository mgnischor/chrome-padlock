/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/offscreen/offscreen.ts
    Description: Offscreen document script that clears the clipboard once a copied password expires.
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
import { sha256Hex } from "../shared/hash";
import { isClearClipboard } from "../shared/messages";

/**
 * Clears the clipboard, but only if it still contains the password that was
 * copied (identified by its hash). If the user has copied something else in
 * the meantime, their clipboard is left alone.
 *
 * Needs the optional `clipboardRead` / `clipboardWrite` permissions. Uses
 * `execCommand` because the async Clipboard API requires a focused document,
 * which an offscreen document never is.
 *
 * @param expectedHash - SHA-256 (hex) of the copied password.
 * @returns `true` when the clipboard held the password and was cleared.
 */
async function clearIfUnchanged(expectedHash: string): Promise<boolean> {
    const sink = document.getElementById("sink") as HTMLTextAreaElement;
    try {
        sink.value = "";
        sink.focus();
        if (!document.execCommand("paste")) return false;
        if ((await sha256Hex(sink.value)) !== expectedHash) return false;

        // An empty selection cannot be copied, so overwrite with a single space.
        sink.value = " ";
        sink.select();
        return document.execCommand("copy");
    } finally {
        sink.value = "";
    }
}

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || !isClearClipboard(message)) return false;
    clearIfUnchanged(message.hash).then(sendResponse, () => sendResponse(false));
    return true;
});
