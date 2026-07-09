import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const version_id = searchParams.get('version_id')
  const type_id = searchParams.get('type_id')
  const slug = searchParams.get('slug')

  if (slug) {
    const { data, error } = await supabaseAdmin
      .from('activity_sessions')
      .select('*')
      .eq('slug', slug)
      .single()
    if (error) return apiError(error, 400)
    return apiOk(data)
  }

  if (version_id) {
    const { data, error } = await supabaseAdmin
      .from('activity_sessions')
      .select('*')
      .eq('activity_version_id', version_id)
      .order('session_date', { ascending: false })
    if (error) return apiError(error, 400)
    return apiOk(data ?? [])
  }

  if (type_id) {
    const { data, error } = await supabaseAdmin
      .from('activity_sessions')
      .select('*')
      .eq('activity_type_id', type_id)
      .order('session_date', { ascending: false })
    if (error) return apiError(error, 400)
    return apiOk(data ?? [])
  }

  // No filter — return all
  const { data, error } = await supabaseAdmin
    .from('activity_sessions')
    .select('*')
    .order('session_date', { ascending: false })
  if (error) return apiError(error, 400)
  return apiOk(data ?? [])
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const body = await req.json()

  // auto slug
  let slug = body.slug
  if (!slug && body.title) {
    slug = body.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 60) + '-' + Date.now()
  }

  const insertData: any = {
    title: body.title,
    slug,
    description: body.description || '',
    cover_image_url: body.cover_image_url || '',
    youtube_url: body.youtube_url || '',
    pdf_url: body.pdf_url || '',
    gallery_urls: body.gallery_urls || [],
    is_published: body.is_published ?? false,
    location: body.location || '',
    session_date: body.session_date || null,
    is_upcoming: body.is_upcoming ?? false,
    registration_enabled: body.is_upcoming ? (body.registration_enabled ?? false) : false,
    registration_note: body.registration_note || '',
    event_dates: body.event_dates || [],
    bg_color: body.bg_color || null,
  }

  // activity_type_id — সবসময় required
  if (body.activity_type_id || body.type_id) {
    insertData.activity_type_id = body.activity_type_id || body.type_id
  }

  // version optional
  if (body.activity_version_id || body.version_id) {
    insertData.activity_version_id = body.activity_version_id || body.version_id
    // version থেকেও type_id নাও যদি না থাকে
    if (!insertData.activity_type_id) {
      const { data: ver } = await supabaseAdmin
        .from('activity_versions')
        .select('activity_type_id')
        .eq('id', insertData.activity_version_id)
        .single()
      if (ver) insertData.activity_type_id = ver.activity_type_id
    }
  }
  
  // type direct (version ছাড়া)
  if (body.activity_type_id || body.type_id) {
    insertData.activity_type_id = body.activity_type_id || body.type_id
  }

  const { data, error } = await supabaseAdmin
    .from('activity_sessions')
    .insert(insertData)
    .select()
    .single()
  if (error) return apiError(error, 400)
  return apiOk(data)
}

export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const body = await req.json()
  const { id, ...rest } = body

  const updateData: any = { ...rest }
  if (rest.version_id) { updateData.activity_version_id = rest.version_id; delete updateData.version_id }
  if (rest.type_id) { updateData.activity_type_id = rest.type_id; delete updateData.type_id }
  // NOTE: previously this also did `updateData.event_date = rest.session_date`, writing to a
  // column called `event_date` that does not exist anywhere else in this schema (POST uses
  // `session_date` directly, and that's the only date column on this table). That stray line
  // appears to be leftover from an earlier refactor and would make Supabase reject any session
  // update that included a date, since `event_date` isn't a real column. Removed — `session_date`
  // already flows through correctly via the `...rest` spread above.

  const { data, error } = await supabaseAdmin
    .from('activity_sessions')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()
  if (error) return apiError(error, 400)
  return apiOk(data)
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { id } = await req.json()
  const { error } = await supabaseAdmin
    .from('activity_sessions')
    .delete()
    .eq('id', id)
  if (error) return apiError(error, 400)
  return apiOk({ success: true })
}
