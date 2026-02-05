import { randomBytes, scrypt } from "crypto";

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };

const scryptAsync = (password, salt, keyLength, options) =>
  new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) return reject(error);
      resolve(derivedKey);
    });
  });

const pw = process.env.PW;
if (!pw) throw new Error("PW is missing");

const salt = randomBytes(16);
const derivedKey = await scryptAsync(pw, salt, KEY_LENGTH, SCRYPT_OPTIONS);

const out = [
  "scrypt",
  SCRYPT_OPTIONS.N,
  SCRYPT_OPTIONS.r,
  SCRYPT_OPTIONS.p,
  salt.toString("base64"),
  Buffer.from(derivedKey).toString("base64"),
].join("$");

console.log(out);
