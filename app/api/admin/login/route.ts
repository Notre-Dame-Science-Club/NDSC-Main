import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Simple password — store this in .env as ADMIN_PASSWORD
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  // Check if email exists in admins table
  const { data, error } = await supabaseAdmin
    .from('admins')
    .select('*')
    .eq('email', email)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Access denied. Not an admin.' }, { status: 403 })
  }

  // Set a simple cookie to mark admin session
  const res = NextResponse.json({ success: true })
  res.cookies.set('admin_session', JSON.stringify({ email, role: data.role }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 8, // 8 hours
    path: '/',
  })
  return res
}
