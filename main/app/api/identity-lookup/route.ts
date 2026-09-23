import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiOk } from '@/lib/api/response'

// Shared "have we seen this person before" lookup — searches members,
// olympiad_registrations, and activity_registrations by email OR college
// roll (whichever the person remembers — primary identifier is roll for NDC
// students, email is the fallback/secondary, and the reverse for non-NDC
// participants who may not have a memorable roll format). Returns the most
// recently created matching record's basic info so a registration form can
// pre-fill name/phone/email/college/college_roll/hsc_session without making
// the person re-type everything they've already given the club before.
//
// This does NOT log the person in or create any session — it's purely a
// convenience autofill. A fresh row is still created for whatever new
// registration they're doing; this just saves typing.

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const query = (body?.query || '').trim()
  if (!query || query.length < 3) {
    return apiOk({ found: false })
  }

  const isEmail = query.includes('@')
  const candidates: { source: string; data: any; created_at: string }[] = []

  if (isEmail) {
    const { data: member } = await supabaseAdmin.from('members').select('*').eq('email', query).maybeSingle()
    if (member) candidates.push({ source: 'member', data: member, created_at: member.created_at })

    const { data: olyRegs } = await supabaseAdmin
      .from('olympiad_registrations').select('*').eq('email', query)
      .order('created_at', { ascending: false }).limit(1)
    if (olyRegs?.[0]) candidates.push({ source: 'olympiad', data: olyRegs[0], created_at: olyRegs[0].created_at })

    const { data: actRegs } = await supabaseAdmin
      .from('activity_registrations').select('*').eq('email', query)
      .order('created_at', { ascending: false }).limit(1)
    if (actRegs?.[0]) candidates.push({ source: 'activity', data: actRegs[0], created_at: actRegs[0].created_at })
  } else {
    // Treat as a roll number lookup
    const { data: member } = await supabaseAdmin.from('members').select('*').eq('college_roll', query).maybeSingle()
    if (member) candidates.push({ source: 'member', data: member, created_at: member.created_at })

    const { data: olyRegs } = await supabaseAdmin
      .from('olympiad_registrations').select('*').eq('college_roll', query)
      .order('created_at', { ascending: false }).limit(1)
    if (olyRegs?.[0]) candidates.push({ source: 'olympiad', data: olyRegs[0], created_at: olyRegs[0].created_at })

    const { data: actRegs } = await supabaseAdmin
      .from('activity_registrations').select('*').eq('college_roll', query)
      .order('created_at', { ascending: false }).limit(1)
    if (actRegs?.[0]) candidates.push({ source: 'activity', data: actRegs[0], created_at: actRegs[0].created_at })
  }

  if (candidates.length === 0) return apiOk({ found: false })

  // Prefer the most recently created record across all three sources, so
  // the freshest info wins if someone's phone/college changed since an
  // older registration.
  candidates.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const best = candidates[0].data

  return apiOk({
    found: true,
    info: {
      full_name: best.full_name,
      phone: best.phone,
      email: best.email,
      college: best.college || 'Notre Dame College',
      college_roll: best.college_roll,
      hsc_session: best.hsc_session || best.batch || '',
    },
  })
}
