import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function keyFromSecret() {
  const secret = process.env.SESSION_SECRET || "local-dev-secret";
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const key = keyFromSecret();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptSecret(value?: string | null) {
  if (!value) return null;
  const [ivB64, tagB64, encryptedB64] = value.split(".");
  if (!ivB64 || !tagB64 || !encryptedB64) return null;
  const key = keyFromSecret();
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

export function maskSecret(secret?: string | null) {
  if (!secret) return null;
  if (secret.length <= 4) return "••••";
  return `••••••${secret.slice(-4)}`;
}

