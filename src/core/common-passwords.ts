/*
    Padlock Chrome Extension
    Copyright (C) 2026 Miguel Nischor

    File: src/core/common-passwords.ts
    Description: A short built-in list of very common passwords and words, used by the strength test.
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
 * Passwords and words that attackers try first, roughly from most to least common. The position in
 * the list is used as the guess rank, so the order matters. This is deliberately small: it catches
 * the obvious choices without shipping a large dictionary, and the strength test says so.
 */
export const COMMON_PASSWORDS: readonly string[] = [
    "123456", "password", "12345678", "qwerty", "123456789", "12345", "1234", "111111", "1234567", "dragon",
    "123123", "baseball", "abc123", "football", "monkey", "letmein", "696969", "shadow", "master", "666666",
    "qwertyuiop", "123321", "mustang", "1234567890", "michael", "654321", "superman", "1qaz2wsx", "7777777",
    "121212", "000000", "qazwsx", "123qwe", "killer", "trustno1", "jordan", "jennifer", "zxcvbnm", "asdfgh",
    "hunter", "buster", "soccer", "harley", "batman", "andrew", "tigger", "sunshine", "iloveyou", "2000",
    "charlie", "robert", "thomas", "hockey", "ranger", "daniel", "starwars", "112233", "george", "computer",
    "michelle", "jessica", "pepper", "1111", "zxcvbn", "555555", "11111111", "131313", "freedom", "777777",
    "pass", "maggie", "159753", "aaaaaa", "ginger", "princess", "joshua", "cheese", "amanda", "summer",
    "love", "ashley", "nicole", "chelsea", "biteme", "matthew", "access", "yankees", "987654321", "dallas",
    "austin", "thunder", "taylor", "matrix", "minecraft", "admin", "welcome", "login", "passw0rd", "password1",
    "qwerty123", "football1", "monkey1", "letmein1", "dragon1", "master1", "hello", "hello123", "freedom1",
    "whatever", "qwe123", "iloveyou1", "princess1", "admin123", "root", "toor", "test", "guest", "changeme",
    "secret", "default", "azerty", "motdepasse", "contrasena", "senha", "senha123", "abcd1234", "1q2w3e4r",
    "1q2w3e", "a1b2c3", "zaq12wsx", "passer", "trustno", "lovely", "flower", "hottie", "loveme", "mypass",
    "pa55word", "p@ssword", "qwertyui", "asdfghjkl", "abcdef", "abcdefg", "abcdefgh", "password123",
    "pass123", "user", "demo", "temp", "sample", "internet", "samsung", "google", "facebook", "master123",
];
