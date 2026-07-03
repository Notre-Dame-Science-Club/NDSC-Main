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

  const { error } = await supabaseAdmin
    .from('members')
    .update({ is_verified: verified })
    .eq('id', id)

  if (error) return apiError(error, 400)

  return NextResponse.redirect(new URL('/admin/members', req.url))
}
