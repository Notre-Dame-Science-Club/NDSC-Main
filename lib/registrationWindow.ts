// S9: server-side registration-open rules (pure, unit-tested).
// Activities: open iff is_upcoming && registration_enabled && reg_deadline not passed.
// Olympiads:  open iff is_active !== false && registration_deadline not passed.
// Null/undefined flags are treated leniently so legacy rows keep working
// (only an explicit `false` closes), except is_upcoming which the UI also requires.
export type OpenResult = { open: true } | { open: false; reason: string }

export function activityRegistrationOpen(s: any, now = new Date()): OpenResult {
  if (!s) return { open: false, reason: 'This event could not be found.' }
  if (s.is_upcoming === false) return { open: false, reason: 'Registration is closed for this event.' }
  if (s.registration_enabled === false) return { open: false, reason: 'Registration is not open for this event.' }
  if (s.reg_deadline && now > new Date(s.reg_deadline)) return { open: false, reason: 'The registration deadline has passed.' }
  return { open: true }
}

export function olympiadRegistrationOpen(o: any, now = new Date()): OpenResult {
  if (!o) return { open: false, reason: 'This olympiad could not be found.' }
  if (o.is_active === false) return { open: false, reason: 'This olympiad is not open for registration.' }
  if (o.registration_deadline && now > new Date(o.registration_deadline)) return { open: false, reason: 'The registration deadline has passed.' }
  return { open: true }
}
