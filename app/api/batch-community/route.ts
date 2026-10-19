import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getMemberFromRequest } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api/response'
import { isBatch28 } from '@/lib/batch28'

// NDSC community links + organizer contacts for Notre Dame College Batch 28 only
// (NDC student, 8-digit roll starting with 128). The decision is made HERE from the
// member's own profile row; the links never ship in the client bundle, so nobody else
// — member or non-member — can read them from the page source.

const WHATSAPP_COMMUNITY = 'https://chat.whatsapp.com/GjI3uKHaVKg7KO0qSCOHxU?s=sw&p=a&mlu=4&ilr=4'
const MESSENGER_GROUP = 'https://m.me/j/BM3mcuiyHsZM2Hvv/?send_source=gc%3Acopy_invite_link_c'

const ORGANIZERS = [
  { name: 'Misbah', whatsapp: '01633031393' },
  { name: 'Mohammed', whatsapp: '01707705085' },
  { name: 'Azizul', whatsapp: '01344013298' },
]

export async function GET(req: NextRequest) {
  const me = await getMemberFromRequest(req)
  if (!me) return apiError('Unauthorized. Please log in again.', 401)

  const { data: profile, error } = await supabaseAdmin
    .from('users')
    .select('institution, college_roll')
    .eq('id', me.id)
    .maybeSingle()
  if (error) return apiError(error, 400)

  if (!isBatch28(profile)) return apiOk({ eligible: false })

  return apiOk({
    eligible: true,
    whatsapp: WHATSAPP_COMMUNITY,
    messenger: MESSENGER_GROUP,
    organizers: ORGANIZERS,
  })
}
