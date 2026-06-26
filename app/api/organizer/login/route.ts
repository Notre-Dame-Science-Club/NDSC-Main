import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Organizer auth is fully server-side now.
// Previously the client fetched ALL olympiads + their plaintext organizer_password
// directly via the anon Supabase client and compared it in the browser — this leaked
// every olympiad's organizer password to anyone who opened devtools, even before login.
// Now the password check happens here with the service-role client, and only the
// minimal safe fields (id, name, mode) are ever sent back to the browser.

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: '' }))

  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Password is required.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('olympiads')
    .select('id, name, mode, organizer_password')
    .eq('is_active', true)

  if (error) {
    return NextResponse.json({ error: 'Could not verify password.' }, { status: 500 })
  }

  const matches = (data || []).filter(
    (o: any) => o.organizer_password && o.organizer_password === password
  )

  if (matches.length === 0) {
    return NextResponse.json({ error: 'Incorrect organizer password.' }, { status: 401 })
  }

  const olympiadIds = matches.map((o: any) => o.id)

  const res = NextResponse.json({
    success: true,
    olympiads: matches.map((o: any) => ({ id: o.id, name: o.name, mode: o.mode })),
  })

  res.cookies.set('organizer_session', JSON.stringify({ olympiadIds }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 12, // 12 hours
    path: '/',
  })

  return res
}
