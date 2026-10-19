import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { apiError } from '@/lib/api/response'
import { requireAdmin } from '@/lib/api/admin-auth'

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const formData = await req.formData()
  const id = formData.get('id') as string
  const verified = formData.get('verified') === 'true'

  // Verified == has a row in `members`. This approves (or revokes) membership atomically.
  const { error } = await supabaseAdmin.rpc('admin_set_membership', {
    p_user_id: id,
    p_status: verified ? 'approved' : 'none',
    p_admin: 'admin',
  })

  if (error) return apiError(error, 400)

  return NextResponse.redirect(new URL('/admin/members', req.url))
}
