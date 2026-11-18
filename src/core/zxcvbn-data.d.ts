/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/core/zxcvbn-data.d.ts
    Description: Type declarations for the word lists imported from the zxcvbn-ts packages.
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

/**
 * The packages ship each list as a compressed string that is expanded when the module loads, and
 * declare no types for these files. Each list is an array of words, most common first.
 */
declare module "@zxcvbn-ts/language-common/dist/passwords.json.mjs" {
    const words: string[];
    export default words;
}

declare module "@zxcvbn-ts/language-en/dist/commonWords.json.mjs" {
    const words: string[];
    export default words;
}
