import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'

// Lets a logged-in member (verified or not) submit or replace their
// membership slip photo from the dashboard. This exists because slip
// upload is no longer mandatory at /register — people from other colleges
// or schools can sign up without one, and NDC students who haven't
// collected/submitted their physical slip yet shouldn't be blocked either.
//
// Unlike /api/member-profile, this route intentionally does NOT touch
// is_verified — submitting a slip only queues it for admin review, the
// same as it did when the slip was collected at registration time.
//
// Same Bearer-token auth pattern as /api/member-profile.

async function getMemberFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export async function PUT(req: NextRequest) {
  const user = await getMemberFromRequest(req)
  if (!user) return apiError('Unauthorized. Please log in again.', 401)

  const body = await req.json().catch(() => null)
  const payment_slip_url = body?.payment_slip_url
  if (!payment_slip_url || typeof payment_slip_url !== 'string') {
    return apiError('No slip image was provided.', 400)
  }

  const { data, error } = await supabaseAdmin
    .from('members')
    .update({ payment_slip_url })
    .eq('id', user.id)
    .select()
    .single()

  if (error) return apiError(error.message || 'Could not save your slip.', 400)
  return apiOk({ member: data })
}
