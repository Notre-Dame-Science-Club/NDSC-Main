// Strict server-side validation for /api/auth/register. The client form
// validates too, but bots skip the form, so every rule must live here.

export const EDUCATION_LEVELS = [
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
  'Class 11', 'Class 12', 'SSC', 'HSC', 'University', 'Other',
] as const

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export type RegisterInput = {
  email: string
  password: string
  full_name: string
  institution: string
  education_level: string
  phone: string
}

// Flat result type on purpose: the project's tsconfig is not `strict`, so TypeScript
// cannot narrow a `{ok:true}|{ok:false}` union and the build would fail.
export type RegisterResult = { ok: boolean; error?: string; value?: RegisterInput }

export function validateRegister(body: any): RegisterResult {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid request.' }
  const { email, password, full_name, institution, education_level, phone } = body

  for (const v of [email, password, full_name, institution, education_level, phone]) {
    if (typeof v !== 'string' || !v) return { ok: false, error: 'All fields are required.' }
  }

  const cleanEmail = (email as string).trim().toLowerCase()
  if (cleanEmail.length > 254 || !EMAIL_RE.test(cleanEmail)) {
    return { ok: false, error: 'Enter a valid email address.' }
  }

  // bcrypt (used by Supabase Auth) only looks at the first 72 bytes; a huge
  // password is just a cheap way to burn CPU.
  if ((password as string).length < 8) return { ok: false, error: 'Password must be at least 8 characters.' }
  if ((password as string).length > 72) return { ok: false, error: 'Password must be at most 72 characters.' }

  const name = (full_name as string).trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 100) return { ok: false, error: 'Enter your full name (2–100 characters).' }

  const inst = (institution as string).trim().replace(/\s+/g, ' ')
  if (inst.length < 2 || inst.length > 150) return { ok: false, error: 'Enter your institution (2–150 characters).' }

  if (!(EDUCATION_LEVELS as readonly string[]).includes(education_level as string)) {
    return { ok: false, error: 'Please select a valid education level.' }
  }

  const cleanPhone = (phone as string).replace(/[\s-]/g, '')
  // Bangladeshi mobile: 01[3-9]xxxxxxxx, optionally prefixed with 88 / +88.
  if (!/^(\+?88)?01[3-9]\d{8}$/.test(cleanPhone)) return { ok: false, error: 'Enter a valid phone number.' }

  return {
    ok: true,
    value: {
      email: cleanEmail,
      password: password as string,
      full_name: name,
      institution: inst,
      education_level: education_level as string,
      phone: cleanPhone,
    },
  }
}
