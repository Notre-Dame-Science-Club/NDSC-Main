import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

// Dependency-free password hashing for team-member logins (activity
// registrations). Uses Node's built-in `crypto.scryptSync` rather than
// bcrypt/argon2 so no npm package install is required — scrypt is a solid,
// well-reviewed KDF and this is sufficient for a student-event login system
// (not a high-value account), consistent with the rest of this app's
// security bar (e.g. the organizer login already uses a much simpler
// password comparison).

const KEY_LENGTH = 64

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const hashBuffer = Buffer.from(hash, 'hex')
  const candidateBuffer = scryptSync(password, salt, KEY_LENGTH)
  if (hashBuffer.length !== candidateBuffer.length) return false
  return timingSafeEqual(hashBuffer, candidateBuffer)
}
