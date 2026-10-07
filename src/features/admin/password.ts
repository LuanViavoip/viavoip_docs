import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
export const hashPattern = /^scrypt:131072:8:1:([a-f0-9]{32}):([a-f0-9]{128})$/;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64,
    { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
    (error, key) => error ? reject(error) : resolve(key)));
}

export async function hashAdminPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 1024) throw new Error("Use uma senha com 12 a 1024 caracteres.");
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt:131072:8:1:${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyAdminPassword(password: string, hash: string): Promise<boolean> {
  const match = hashPattern.exec(hash);
  if (!match || !password || password.length > 1024) return false;
  const actual = await derive(password, Buffer.from(match[1], "hex"));
  return timingSafeEqual(actual, Buffer.from(match[2], "hex"));
}

