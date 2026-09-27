// Shared validation for the site-wide identity rule: a college roll number
// is required for every registrant everywhere (members, olympiad
// registrants, activity registrants) — but the "exactly 8 digits" rule only
// applies to Notre Dame College students specifically. Other colleges
// format their own roll numbers differently (different lengths), so for
// anyone else the rule is just "required, digits only".
export function validateCollegeRoll(college: string | undefined | null, roll: string | undefined | null): string | null {
  const trimmedRoll = (roll || '').trim()
  if (!trimmedRoll) return 'College roll is required.'
  if (!/^\d+$/.test(trimmedRoll)) return 'College roll number must contain digits only.'

  const isNDC = (college || 'Notre Dame College').trim().toLowerCase() === 'notre dame college'
  if (isNDC && trimmedRoll.length !== 8) {
    return 'Notre Dame College roll numbers are exactly 8 digits.'
  }
  return null
}
