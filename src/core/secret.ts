/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/core/secret.ts
    Description: Picks between password and passphrase generation for the selected mode.
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
import { analyze, generatePassword, type GeneratorOptions } from "./generator";
import { generatePassphrase, passphraseEntropyBits, type PassphraseOptions } from "./passphrase";
import { cryptoFill, type RandomFill } from "./random";

/** What the generator produces: random characters, or random words. */
export const GENERATOR_MODES = ["password", "passphrase"] as const;

export type GeneratorMode = (typeof GENERATOR_MODES)[number];

/** Everything needed to generate a secret in either mode. */
export interface SecretOptions extends GeneratorOptions {
    mode: GeneratorMode;
    passphrase: PassphraseOptions;
}

/**
 * Generates a password or a passphrase, depending on the mode.
 *
 * @param options - Options of both modes, and which one is active.
 * @param fill - Randomness source; injectable so tests can be deterministic.
 * @returns The generated password or passphrase.
 * @throws GeneratorError when the options of the active mode cannot produce a result.
 */
export function generateSecret(options: SecretOptions, fill: RandomFill = cryptoFill): string {
    return options.mode === "passphrase"
        ? generatePassphrase(options.passphrase, fill)
        : generatePassword(options, fill);
}

/**
 * Computes the entropy of what {@link generateSecret} produces, without generating anything.
 *
 * @param options - Options of both modes, and which one is active.
 * @returns Entropy in bits, or 0 when the options of the active mode cannot produce a result.
 */
export function secretEntropyBits(options: SecretOptions): number {
    return options.mode === "passphrase" ? passphraseEntropyBits(options.passphrase) : analyze(options).entropyBits;
}
