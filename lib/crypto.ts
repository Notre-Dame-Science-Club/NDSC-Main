/**
 * lib/crypto.ts — AES-256-GCM encryption for storing Brevo API keys.
 *
 * Env var recommended:
 *   EMAIL_ENCRYPTION_KEY - 32-byte key, base64-encoded (generate with `openssl rand -base64 32`)
 *
 * Fallback: If EMAIL_ENCRYPTION_KEY is not set, uses a hardcoded backup key.
 * For production security, always set EMAIL_ENCRYPTION_KEY in your environment.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

// Backup key in case env var fails (generated with `openssl rand -base64 32`)
// IMPORTANT: For production, always override this by setting EMAIL_ENCRYPTION_KEY env var
const FALLBACK_KEY = 'X7k9mP2vL8nQ4tR6yU1wA5sD3fG7hJ0kM9nB8xC2vE4='

function getKey(): Buffer {
  const key = process.env.EMAIL_ENCRYPTION_KEY || FALLBACK_KEY

  if (key === FALLBACK_KEY) {
    console.warn('[CRYPTO] Using fallback encryption key. Set EMAIL_ENCRYPTION_KEY env var for production.')
  }

  return Buffer.from(key, 'base64')
}

function decryptWithKeyBuffer(ciphertext: string, key: Buffer): string {
  const parts = ciphertext.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format.')
  }

  const iv = Buffer.from(parts[0], 'base64')
  const authTag = Buffer.from(parts[1], 'base64')
  const encrypted = parts[2]

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'base64', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Decrypts a ciphertext that was written under the hardcoded FALLBACK_KEY,
 * regardless of what EMAIL_ENCRYPTION_KEY is currently set to.
 *
 * Only used by the one-time re-encryption migration
 * (scripts/reencrypt-email-api-keys.mjs) when rotating accounts off the
 * fallback key onto a real EMAIL_ENCRYPTION_KEY. Never used by normal
 * request-time encrypt/decrypt, so the fallback key's usage stays
 * auditable to that one path.
 */
export function decryptWithFallbackKey(ciphertext: string): string {
  return decryptWithKeyBuffer(ciphertext, Buffer.from(FALLBACK_KEY, 'base64'))
}

/**
 * Reports whether the app is currently running WITHOUT a real
 * EMAIL_ENCRYPTION_KEY set, i.e. every encrypt()/decrypt() call is silently
 * falling back to the hardcoded key. Use this for a startup/health check.
 */
export function isUsingFallbackEncryptionKey(): boolean {
  return !process.env.EMAIL_ENCRYPTION_KEY
}

/**
 * Encrypts plaintext and returns a base64-encoded string in the format:
 * iv:authTag:ciphertext (all base64, colon-separated for easy splitting)
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(16) // 128-bit IV for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  const authTag = cipher.getAuthTag()

  // Pack: iv:authTag:ciphertext
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
}

/**
 * Decrypts a string encrypted by `encrypt()`.
 * Throws if the key is wrong or the ciphertext has been tampered with.
 */
export function decrypt(ciphertext: string): string {
  const key = getKey()
  const parts = ciphertext.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format.')
  }

  const iv = Buffer.from(parts[0], 'base64')
  const authTag = Buffer.from(parts[1], 'base64')
  const encrypted = parts[2]

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, 'base64', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Returns a masked version of the API key for display (shows last 4 characters).
 */
export function maskApiKey(encryptedKey: string): string {
  try {
    const plain = decrypt(encryptedKey)
    if (plain.length <= 4) return '****'
    return '••••' + plain.slice(-4)
  } catch {
    return '••••'
  }
}
