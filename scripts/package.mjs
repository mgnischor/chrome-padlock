/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: scripts/package.mjs
    Description: Packaging script that builds, verifies and zips the extension for the Chrome Web Store.
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
 * Produces the zip file to upload to the Chrome Web Store.
 *
 * It runs the production build (everything minified), verifies the result and
 * writes `release/padlock-<version>.zip`. The verification fails the package if
 * a file referenced by the manifest is missing, if development files slipped
 * in, or if the bundled JavaScript contains code that could reach the network
 * or evaluate strings, which the extension is not supposed to do.
 */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { listFiles } from "./files.mjs";
import { MANIFEST_LOCALES } from "./manifest-locales.mjs";
import { createZip } from "./zip.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const releaseDir = path.join(root, "release");

/** Files that must never be part of the package. */
const FORBIDDEN_FILES = /(^|\/)(node_modules|\.git)(\/|$)|\.(map|ts|mjs|md|log)$/;

/** Constructs the built JavaScript must not contain: network access and dynamic code evaluation. */
const FORBIDDEN_CODE = [
    [/\bfetch\s*\(/, "fetch()"],
    [/XMLHttpRequest/, "XMLHttpRequest"],
    [/\bWebSocket\b/, "WebSocket"],
    [/\bEventSource\b/, "EventSource"],
    [/sendBeacon/, "navigator.sendBeacon"],
    [/\bimportScripts\b/, "importScripts"],
    [/\beval\s*\(/, "eval()"],
    [/\bnew\s+Function\s*\(/, "new Function()"],
    [/https?:\/\//, "an http(s) URL"],
];

/**
 * Collects every package-relative path the manifest points to.
 *
 * @param manifest - The built `manifest.json`.
 * @returns Paths of icons, the popup page and the service worker.
 */
function manifestFiles(manifest) {
    return [
        ...Object.values(manifest.icons ?? {}),
        ...Object.values(manifest.action?.default_icon ?? {}),
        manifest.action?.default_popup,
        manifest.background?.service_worker,
    ].filter(Boolean);
}

/**
 * Checks the built package and returns a list of problems.
 *
 * @param files - Paths inside `dist`, with forward slashes.
 * @param version - Version from `package.json`.
 * @returns Human-readable problems; empty when the package is sound.
 */
async function verify(files, version) {
    const problems = [];
    const fileSet = new Set(files);

    const manifest = JSON.parse(await readFile(path.join(dist, "manifest.json"), "utf8"));
    if (manifest.version !== version) problems.push(`manifest version ${manifest.version} != package version ${version}`);
    for (const file of manifestFiles(manifest)) {
        if (!fileSet.has(file)) problems.push(`manifest references a missing file: ${file}`);
    }

    const defaultMessages = `_locales/${manifest.default_locale}/messages.json`;
    if (!fileSet.has(defaultMessages)) {
        problems.push(`missing default locale: ${defaultMessages}`);
    } else {
        const messages = JSON.parse(await readFile(path.join(dist, defaultMessages), "utf8"));
        for (const [, key] of JSON.stringify(manifest).matchAll(/__MSG_([A-Za-z0-9_@]+)__/g)) {
            if (!(key in messages)) problems.push(`manifest uses an undefined message: ${key}`);
        }
    }

    for (const file of files) {
        const locale = file.match(/^_locales\/([^/]+)\//)?.[1];
        if (locale && !MANIFEST_LOCALES.includes(locale)) problems.push(`locale folder Chrome does not support: ${locale}`);
        if (FORBIDDEN_FILES.test(file)) problems.push(`development file in the package: ${file}`);
        if (file.endsWith(".html")) {
            const html = await readFile(path.join(dist, file), "utf8");
            for (const [, script] of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) {
                if (!fileSet.has(script)) problems.push(`${file} loads a missing script: ${script}`);
            }
            if (/<script\b(?![^>]*\bsrc=)[^>]*>/.test(html)) problems.push(`${file} contains an inline script`);
        }
        if (file.endsWith(".js")) {
            const code = await readFile(path.join(dist, file), "utf8");
            for (const [pattern, label] of FORBIDDEN_CODE) {
                if (pattern.test(code)) problems.push(`${file} contains ${label}`);
            }
        }
    }
    return problems;
}

/**
 * Formats a byte count for the size report.
 *
 * @param bytes - Size in bytes.
 * @returns A value such as `9.4 kB`.
 */
function formatSize(bytes) {
    return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`;
}

execFileSync(process.execPath, [path.join(root, "scripts", "build.mjs")], { stdio: "inherit" });

const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const files = await listFiles(dist);
const problems = await verify(files, pkg.version);
if (problems.length > 0) {
    console.error("Package verification failed:");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
}

const entries = [];
let uncompressed = 0;
for (const file of files) {
    const data = await readFile(path.join(dist, file));
    uncompressed += data.length;
    entries.push({ name: file, data });
}

await rm(releaseDir, { recursive: true, force: true });
await mkdir(releaseDir, { recursive: true });
const zipPath = path.join(releaseDir, `padlock-${pkg.version}.zip`);
await writeFile(zipPath, createZip(entries));

console.log(`\nVerified ${files.length} files (${formatSize(uncompressed)}).`);
console.log(`Package: ${path.relative(root, zipPath)} (${formatSize((await stat(zipPath)).size)})`);
