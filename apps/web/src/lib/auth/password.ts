/**
 * Password hashing wrapper (NFR §4.2 / Wave 3 SEC-006).
 *
 * Production target: argon2id (t=3, m=64MiB, p=4 — OWASP 2023).
 *
 * Current implementation: Node built-in `crypto.scrypt` (N=2^15, r=8, p=1,
 * 32-byte salt, 64-byte derived key). Scrypt is OWASP-listed as an acceptable
 * fallback to argon2id. The encoded hash format is self-describing so an
 * argon2id backend can be swapped in later without changing call sites:
 *
 *   <algo>$<params...>$<salt-hex>$<hash-hex>
 *
 * Examples:
 *   scrypt$N=32768,r=8,p=1$<salt-hex>$<hash-hex>
 *   argon2id$m=65536,t=3,p=4$<salt-hex>$<hash-hex>     (future)
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem?: number },
) => Promise<Buffer>;

const SCRYPT_N = 1 << 15; // 32768
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;
const MAXMEM = 64 * 1024 * 1024; // 64 MiB cap, matches argon2id target

function toHex(buf: Buffer): string {
  return buf.toString("hex");
}

function fromHex(hex: string): Buffer {
  return Buffer.from(hex, "hex");
}

/**
 * Parse `N=32768,r=8,p=1`-style param string. Returns null on any malformed
 * input so callers can treat verification as a boolean.
 */
function parseParams(paramStr: string): { N: number; r: number; p: number } | null {
  const out: Record<string, number> = {};
  for (const kv of paramStr.split(",")) {
    const [k, v] = kv.split("=");
    const n = Number(v);
    if (!k || !Number.isFinite(n) || n <= 0) return null;
    out[k] = n;
  }
  if (typeof out.N !== "number" || typeof out.r !== "number" || typeof out.p !== "number") {
    return null;
  }
  return { N: out.N, r: out.r, p: out.p };
}

/**
 * Hash a plaintext password using a memory-hard KDF.
 * Returns a self-describing encoded string safe to store in `password_hash`.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("password must be a non-empty string");
  }
  const salt = randomBytes(SALT_LEN);
  const key = await scrypt(plaintext, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: MAXMEM,
  });
  return `scrypt$N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}$${toHex(salt)}$${toHex(key)}`;
}

/**
 * Verify a plaintext password against an encoded hash.
 * Returns false (never throws) on malformed input or wrong password so callers
 * can use the result as a plain boolean.
 */
export async function verifyPassword(encoded: string, plaintext: string): Promise<boolean> {
  if (typeof encoded !== "string" || typeof plaintext !== "string") {
    return false;
  }
  const parts = encoded.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") {
    return false;
  }
  const [, paramStr, saltHex, hashHex] = parts as [string, string, string, string];
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = fromHex(saltHex);
    expected = fromHex(hashHex);
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) {
    return false;
  }
  const params = parseParams(paramStr);
  if (!params) return false;
  let actual: Buffer;
  try {
    actual = await scrypt(plaintext, salt, expected.length, {
      ...params,
      maxmem: MAXMEM,
    });
  } catch {
    return false;
  }
  // Constant-time comparison
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
