import crypto from "crypto";
import { env } from "../config/env.config.js";
import type { EncryptedField } from "../types/encryptedField.type.js";

const ALGORITHM: "aes-256-gcm" = env.MESSAGE_CONTENT_ENCRYPTION_ALGORITHM;
const IV_LENGTH: number = env.MESSAGE_CONTENT_ENCRYPTION_IV_LENGTH

// Derive a 256-bit key from the secret
function getKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret).digest();
}

// Validate if secret is a proper 32-byte hex string
function isValidHexKey(secret: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(secret);
}

/**
 * Encrypt plain text
 * @param text - The plain text to encrypt
 * @param secret - Secret key (from env, e.g. CONTENT_ENCRYPTION_KEY)
 * @returns {Object} { iv, content, tag }
 */
export function encrypt(text: string, secret: string): EncryptedField {
  const iv = crypto.randomBytes(IV_LENGTH);

  // Decide how to build the key
  const key = isValidHexKey(secret)
    ? Buffer.from(secret, "hex") // already a 32-byte key
    : getKey(secret);            // derive from passphrase

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  return { 
    iv: iv.toString("hex"),
    content: encrypted,
    tag: authTag,
  } as EncryptedField;
}

/**
 * Decrypt cipher text
 * @param encrypted - Object returned by encrypt()
 * @param secret - Secret key (must be the same as used in encrypt)
 * @returns {string} - Decrypted plain text
 */
export function decrypt(
  encrypted: { iv: string; content: string; tag: string },
  secret: string
): string {
  // Decide how to build the key
  const key = isValidHexKey(secret)
    ? Buffer.from(secret, "hex") // already a 32-byte key
    : getKey(secret);  

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(encrypted.iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(encrypted.tag, "hex"));

  let decrypted: string = decipher.update(encrypted.content, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
