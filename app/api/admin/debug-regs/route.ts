import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// TEMPORARY DEBUG ROUTE — remove after fixing
export async function GET() {
  const cookieStore = await cookies()
  const isAdmin = !!cookieStore.get('admin_session')

  // 1. Check env vars are loaded
  const envCheck = {
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    isAdmin,
  }

  // 2. Try fetching ALL registrations (no filter) with supabaseAdmin
  const { data: allRegs, error: allError } = await supabaseAdmin
    .from('olympiad_registrations')
    .select('id, full_name, olympiad_id, created_at')
    .limit(20)

  // 3. Try fetching all olympiads
  const { data: allOlympiads, error: olympError } = await supabaseAdmin
    .from('olympiads')
    .select('id, name, is_active')
    .limit(10)

  return NextResponse.json({
    envCheck,
    registrations: { data: allRegs, error: allError?.message },
    olympiads: { data: allOlympiads, error: olympError?.message },
  })
}
