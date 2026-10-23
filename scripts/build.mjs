/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: scripts/build.mjs
    Description: Build script that bundles the extension into the dist folder.
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
 * Bundles the extension into `./dist`: esbuild for the TypeScript entry points,
 * plus a straight copy of `./public` (including the `_locales` folder) with the
 * manifest version taken from `package.json`.
 */
import { build, context } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const watch = process.argv.includes("--watch");

const buildOptions = {
    entryPoints: {
        popup: path.join(root, "src/popup/popup.ts"),
        "service-worker": path.join(root, "src/background/service-worker.ts"),
        offscreen: path.join(root, "src/offscreen/offscreen.ts"),
    },
    outdir: dist,
    bundle: true,
    format: "iife",
    target: "chrome116",
    minify: !watch,
    sourcemap: watch ? "inline" : false,
    legalComments: "none",
    logLevel: "info",
};

/** Copies the static files into `dist` and stamps the manifest with the `package.json` version. */
async function copyStatic() {
    await cp(path.join(root, "public"), dist, { recursive: true });

    const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
    const manifestPath = path.join(dist, "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.version = pkg.version;
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await copyStatic();

if (watch) {
    const ctx = await context(buildOptions);
    await ctx.watch();
    console.log("Watching for changes. Reload the extension in chrome://extensions after rebuilds.");
} else {
    await build(buildOptions);
    console.log(`Extension built in ${path.relative(process.cwd(), dist) || "."}`);
}
