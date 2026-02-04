import 'server-only';

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCallback);

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024
};

export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS)) as Buffer;
  return [
    'scrypt',
    SCRYPT_OPTIONS.N,
    SCRYPT_OPTIONS.r,
    SCRYPT_OPTIONS.p,
    salt.toString('base64'),
    derivedKey.toString('base64')
  ].join('$');
};

export const verifyPassword = async (
  password: string,
  storedHash: string
): Promise<boolean> => {
  const [scheme, n, r, p, saltBase64, hashBase64] = storedHash.split('$');
  if (scheme !== 'scrypt' || !saltBase64 || !hashBase64) {
    return false;
  }

  const options = {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT_OPTIONS.maxmem
  };

  if (!options.N || !options.r || !options.p) {
    return false;
  }

  const salt = Buffer.from(saltBase64, 'base64');
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH, options)) as Buffer;
  const expected = Buffer.from(hashBase64, 'base64');

  if (expected.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(expected, derivedKey);
};
