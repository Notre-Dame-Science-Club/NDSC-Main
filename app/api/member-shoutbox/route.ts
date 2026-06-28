import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

// Members-only live feed shown on the dashboard Home tab. Distinct from:
//   - NDSCBot (the public AI assistant widget)
//   - admin announcements (one-way, admin → everyone)
// This is members talking to other members — short posts, newest first.
//
// Auth follows the same pattern as /api/member-achievements: the member's
// Supabase access token is sent as a Bearer header, since the session lives
// in the browser's localStorage, not an HTTP cookie the server would see
// automatically.

const MAX_MESSAGE_LENGTH = 500
const FEED_LIMIT = 50

async function getMemberFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export async function GET(req: NextRequest) {
  const user = await getMemberFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized. Please log in again.' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('member_shoutbox')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(FEED_LIMIT)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ posts: data || [] })
}

export async function POST(req: NextRequest) {
  const user = await getMemberFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized. Please log in again.' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const message = typeof body?.message === 'string' ? body.message.trim() : ''

  if (!message) return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 400 })
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `Message must be under ${MAX_MESSAGE_LENGTH} characters.` }, { status: 400 })
  }

  // Confirm this is a verified member (not just any authenticated auth.user)
  // before letting them post to a feed every other member can see.
  const { data: member, error: memberError } = await supabaseAdmin
    .from('members')
    .select('id, full_name, is_verified')
    .eq('id', user.id)
    .single()

  if (memberError || !member || !member.is_verified) {
    return NextResponse.json({ error: 'Only verified members can post.' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('member_shoutbox')
    .insert({ member_id: member.id, full_name: member.full_name, message })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ post: data })
}
