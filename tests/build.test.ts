/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: tests/build.test.ts
    Description: Unit tests for the build tooling: minifiers, CRC-32 and the zip writer.
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
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { crc32 } from "../scripts/crc32.mjs";
import { minifyCss, minifyHtml, minifyJson, stripTranslatorNotes } from "../scripts/minify.mjs";
import { createZip } from "../scripts/zip.mjs";

const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
const SOURCE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

/**
 * Reads a file of the `public` folder.
 *
 * @param file - Path relative to `public`.
 * @returns The file contents.
 */
function readPublic(file: string): string {
    return readFileSync(path.join(PUBLIC_DIR, file), "utf8");
}

/**
 * Extracts every value of an attribute from a piece of HTML.
 *
 * @param html - The markup to scan.
 * @param attribute - Attribute name, for example `id`.
 * @returns The values in document order.
 */
function attributeValues(html: string, attribute: string): string[] {
    return [...html.matchAll(new RegExp(`\\s${attribute}="([^"]*)"`, "g"))].map((match) => match[1]!);
}

describe("minifyHtml", () => {
    it("removes comments and collapses whitespace", () => {
        const html =
            "<!doctype html>\n<!-- license -->\n<html>\n  <body>\n    <p>Hello\n      world</p>\n  </body>\n</html>\n";
        expect(minifyHtml(html)).toBe("<!doctype html><html><body><p>Hello world</p></body></html>");
    });

    it("leaves quoted attribute values untouched, even with spaces, newlines and angle brackets", () => {
        const html = '<input   id="a"\n   title="two  spaces > here"\n   placeholder=\'x  y\' />';
        expect(minifyHtml(html)).toBe('<input id="a" title="two  spaces > here" placeholder=\'x  y\'/>');
    });

    it("preserves the content of whitespace-sensitive elements", () => {
        const html =
            '<textarea id="t">  keep\n   this  </textarea>\n<pre>a\n  b</pre>\n<script>let a  =  1;\n</script>';
        const minified = minifyHtml(html);
        expect(minified).toContain('<textarea id="t">  keep\n   this  </textarea>');
        expect(minified).toContain("<pre>a\n  b</pre>");
        expect(minified).toContain("<script>let a  =  1;\n</script>");
    });

    it("is idempotent", () => {
        const once = minifyHtml(readPublic("popup.html"));
        expect(minifyHtml(once)).toBe(once);
    });

    it.each(["popup.html", "offscreen.html"])("keeps every element id, script and i18n key of %s", (file) => {
        const source = readPublic(file);
        const minified = minifyHtml(source);
        for (const attribute of ["id", "src", "data-i18n", "data-i18n-title", "data-i18n-aria-label", "href"]) {
            expect(attributeValues(minified, attribute), attribute).toEqual(attributeValues(source, attribute));
        }
        expect(minified.startsWith("<!doctype html>")).toBe(true);
        expect(minified).not.toContain("<!--");
        expect(minified.length).toBeLessThan(source.length);
    });

    it("never leaves a placeholder character behind", () => {
        expect(minifyHtml(readPublic("offscreen.html"))).not.toContain("\u0000");
    });
});

describe("minifyCss", () => {
    it("removes comments and whitespace but keeps the rules", async () => {
        const css = "/* header */\n.a  {\n  color: red;\n}\n.b:has(.c) { margin: 0 }\n";
        const minified = await minifyCss(css);
        expect(minified).not.toContain("/*");
        expect(minified).not.toMatch(/\n/);
        expect(minified).toContain(".a{color:red}");
        expect(minified).toContain(".b:has(.c){margin:0}");
    });

    it("shrinks the popup stylesheet and keeps its custom properties", async () => {
        const source = readPublic("popup.css");
        const minified = await minifyCss(source);
        expect(minified.length).toBeLessThan(source.length * 0.8);
        for (const name of source.match(/--[a-z0-9-]+(?=:)/g) ?? []) expect(minified).toContain(name);
    });
});

describe("minifyJson / stripTranslatorNotes", () => {
    it("removes insignificant whitespace", () => {
        expect(minifyJson('{\n  "a": [1,  2],\n  "b": "x y"\n}')).toBe('{"a":[1,2],"b":"x y"}');
    });

    it("drops descriptions and placeholder examples but keeps everything Chrome needs", () => {
        const messages = {
            greeting: {
                message: "Hi $NAME$",
                description: "note for translators",
                placeholders: { name: { content: "$1", example: "Ana" } },
            },
            plain: { message: "Hello", description: "another note" },
        };
        expect(stripTranslatorNotes(messages)).toEqual({
            greeting: { message: "Hi $NAME$", placeholders: { name: { content: "$1" } } },
            plain: { message: "Hello" },
        });
        expect(messages.greeting.description).toBe("note for translators");
    });

    it("keeps every message and placeholder of the real locales", () => {
        for (const locale of ["en_US", "pt_BR", "es", "ja", "ar"]) {
            const original = JSON.parse(readFileSync(path.join(SOURCE_DIR, "locales", `${locale}.json`), "utf8"));
            const stripped = stripTranslatorNotes(original) as Record<string, any>;
            expect(Object.keys(stripped)).toEqual(Object.keys(original));
            for (const [key, entry] of Object.entries<any>(original)) {
                expect(stripped[key].message).toBe(entry.message);
                expect(Object.keys(stripped[key].placeholders ?? {})).toEqual(Object.keys(entry.placeholders ?? {}));
            }
        }
    });
});

describe("crc32", () => {
    it("matches the standard check value", () => {
        expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    });

    it("is 0 for no data", () => {
        expect(crc32(new Uint8Array())).toBe(0);
    });
});

/** One file read back from a zip archive. */
interface ZipEntry {
    name: string;
    method: number;
    crc: number;
    data: Buffer;
}

/**
 * Reads a zip archive through its central directory, the way unzip tools do.
 *
 * @param zip - The archive bytes (without an archive comment).
 * @returns The entries in archive order, with their data decompressed.
 */
function readZip(zip: Buffer): ZipEntry[] {
    const end = zip.length - 22;
    expect(zip.readUInt32LE(end)).toBe(0x06054b50);
    const count = zip.readUInt16LE(end + 10);
    let cursor = zip.readUInt32LE(end + 16);

    const entries: ZipEntry[] = [];
    for (let i = 0; i < count; i++) {
        expect(zip.readUInt32LE(cursor)).toBe(0x02014b50);
        const method = zip.readUInt16LE(cursor + 10);
        const crc = zip.readUInt32LE(cursor + 16);
        const compressedSize = zip.readUInt32LE(cursor + 20);
        const size = zip.readUInt32LE(cursor + 24);
        const nameLength = zip.readUInt16LE(cursor + 28);
        const localOffset = zip.readUInt32LE(cursor + 42);
        const name = zip.toString("utf8", cursor + 46, cursor + 46 + nameLength);
        cursor += 46 + nameLength;

        expect(zip.readUInt32LE(localOffset)).toBe(0x04034b50);
        const start = localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
        const stored = zip.subarray(start, start + compressedSize);
        const data = method === 8 ? inflateRawSync(stored) : Buffer.from(stored);
        expect(data.length, name).toBe(size);
        entries.push({ name, method, crc, data });
    }
    return entries;
}

describe("createZip", () => {
    const files = [
        { name: "manifest.json", data: Buffer.from('{"a":1}'.repeat(50)) },
        { name: "_locales/pt_BR/messages.json", data: Buffer.from("Olá, é ção") },
        { name: "empty.txt", data: Buffer.alloc(0) },
        { name: "icons/icon.png", data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]) },
    ];

    it("stores every file with the right name, content and checksum", () => {
        const entries = readZip(createZip(files));
        expect(entries.map((entry) => entry.name)).toEqual(files.map((file) => file.name));
        entries.forEach((entry, index) => {
            expect(entry.data.equals(files[index]!.data), entry.name).toBe(true);
            expect(entry.crc, entry.name).toBe(crc32(files[index]!.data));
        });
    });

    it("compresses data that shrinks and stores data that does not", () => {
        const methods = Object.fromEntries(readZip(createZip(files)).map((entry) => [entry.name, entry.method]));
        expect(methods["manifest.json"]).toBe(8);
        expect(methods["empty.txt"]).toBe(0);
        expect(methods["icons/icon.png"]).toBe(0);
    });

    it("is reproducible: the same input always gives the same bytes", () => {
        expect(createZip(files).equals(createZip(files))).toBe(true);
    });

    it("writes a valid, empty archive for no files", () => {
        const zip = createZip([]);
        expect(zip.length).toBe(22);
        expect(zip.readUInt32LE(0)).toBe(0x06054b50);
    });
});
