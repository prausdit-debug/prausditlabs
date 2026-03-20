/**
 * lib/crypto.ts — AES-256-GCM symmetric encryption for API keys stored in the database.
 *
 * WHY: All third-party API keys (Gemini, OpenRouter, Tavily, Exa, Cloudinary…) are
 * stored in the AISettings table. Storing them in plaintext means a DB backup, a
 * misconfigured role, or Prisma Studio access instantly leaks all credentials.
 *
 * HOW: Each key is encrypted with AES-256-GCM using a random IV per encryption.
 * The stored format is:  <hex-iv>:<hex-authTag>:<hex-ciphertext>
 * isEncrypted() detects this format so old plaintext values continue to work
 * during a gradual migration (backward-compatible on first read).
 *
 * SETUP: Add to Vercel environment variables (never commit this value):
 *   SETTINGS_ENCRYPTION_KEY=<64 hex chars — 32 random bytes>
 *
 * Generate a key:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

// ─── Key resolution ───────────────────────────────────────────────────────────

function getEncryptionKey(): Buffer | null {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY?.trim()
  if (!raw) return null
  if (raw.length !== 64) {
    console.warn("[crypto] SETTINGS_ENCRYPTION_KEY must be 64 hex characters (32 bytes). Encryption disabled.")
    return null
  }
  return Buffer.from(raw, "hex")
}

// ─── Format detection ─────────────────────────────────────────────────────────

/**
 * Returns true if the value looks like an AES-256-GCM encrypted string
 * (format: <32-hex-iv>:<32-hex-tag>:<hex-ciphertext>).
 * Used for backward-compatible reads of pre-encryption plaintext values.
 */
export function isEncrypted(val: string): boolean {
  const parts = val.split(":")
  if (parts.length !== 3) return false
  const [iv, tag] = parts
  return /^[0-9a-f]{32}$/i.test(iv) && /^[0-9a-f]{32}$/i.test(tag)
}

// ─── Encrypt ──────────────────────────────────────────────────────────────────

/**
 * Encrypts a plaintext API key.
 * Returns the ciphertext string, or the original plaintext if
 * SETTINGS_ENCRYPTION_KEY is not configured (graceful degradation).
 */
export function encryptKey(plaintext: string): string {
  if (!plaintext) return plaintext
  if (isEncrypted(plaintext)) return plaintext // already encrypted

  const key = getEncryptionKey()
  if (!key) {
    // Encryption not configured — return plaintext (warn once in dev)
    if (process.env.NODE_ENV === "development") {
      console.warn("[crypto] SETTINGS_ENCRYPTION_KEY not set. API keys stored in plaintext.")
    }
    return plaintext
  }

  const iv = randomBytes(16)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()

  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`
}

// ─── Decrypt ──────────────────────────────────────────────────────────────────

/**
 * Decrypts an encrypted API key.
 * If the value is plaintext (pre-encryption data), returns it as-is.
 * If SETTINGS_ENCRYPTION_KEY is not configured, returns the value unchanged.
 */
export function decryptKey(value: string): string {
  if (!value) return value
  if (!isEncrypted(value)) return value // plaintext — backward compatible

  const key = getEncryptionKey()
  if (!key) return value // key not configured — can't decrypt

  try {
    const [ivHex, tagHex, encHex] = value.split(":")
    const iv         = Buffer.from(ivHex,  "hex")
    const tag        = Buffer.from(tagHex, "hex")
    const encrypted  = Buffer.from(encHex, "hex")

    const decipher = createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAuthTag(tag)
    return decipher.update(encrypted).toString("utf8") + decipher.final("utf8")
  } catch (err) {
    console.error("[crypto] Decryption failed — returning value as-is:", err instanceof Error ? err.message : err)
    return value
  }
}
