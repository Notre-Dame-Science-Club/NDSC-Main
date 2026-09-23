import { supabaseAdmin } from '@/lib/supabase'
import { normalizeUploadUrl } from '@/lib/uploadUrl'
import { apiOk } from '@/lib/api/response'

// Public route — no auth required, this is a site-wide popup, not
// audience-targeted like the survey one.
//
// Returns every published session with notify_publicly = true, newest
// first. `ActivityNotification` (components/ActivityNotification.tsx)
// picks the first one the visitor hasn't dismissed yet.
//
// Safety net: an admin can forget to turn this back off once an event has
// happened, so — in addition to the manual flag — sessions whose last
// relevant date is clearly in the past (yesterday or earlier) are excluded
// here rather than trusting notify_publicly alone.
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('activity_sessions')
    .select(`
      id, title, slug, description, cover_image_url, session_date, event_dates,
      location, registration_enabled, registration_note, reg_status, reg_deadline,
      activity_types ( name )
    `)
    .eq('is_published', true)
    .eq('notify_publicly', true)
    .order('session_date', { ascending: false })
    .limit(10)

  if (error) return apiOk([], { status: 200 })

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const stillRelevant = (s: any) => {
    const dates: string[] = (s.event_dates && s.event_dates.length > 0) ? s.event_dates : (s.session_date ? [s.session_date] : [])
    if (dates.length === 0) return true // no date set at all — treat as always relevant, admin's call
    const last = dates.map((d: string) => new Date(d).getTime()).sort((a, b) => b - a)[0]
    return last >= startOfToday.getTime()
  }

  const result = (data || [])
    .filter(stillRelevant)
    .map((s: any) => ({
      id: s.id,
      title: s.title,
      slug: s.slug,
      description: s.description,
      cover_image_url: normalizeUploadUrl(s.cover_image_url),
      session_date: s.session_date,
      event_dates: s.event_dates || [],
      location: s.location,
      registration_enabled: s.registration_enabled,
      registration_note: s.registration_note,
      reg_status: s.reg_status,
      reg_deadline: s.reg_deadline,
      type_name: s.activity_types?.name || null,
    }))

  return apiOk(result)
}
