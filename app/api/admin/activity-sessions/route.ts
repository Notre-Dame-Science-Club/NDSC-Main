import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin, isAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

export async function GET(req: NextRequest) {
  // Check if user is admin
  const userIsAdmin = await isAdmin()

  const { searchParams } = new URL(req.url)
  const version_id = searchParams.get('version_id')
  const type_id = searchParams.get('type_id')
  const slug = searchParams.get('slug')
  const id = searchParams.get('id')

  if (id) {
    let query = supabaseAdmin
      .from('activity_sessions')
      .select('*')
      .eq('id', id)

    // Non-admins can only see published sessions
    if (!userIsAdmin) {
      query = query.eq('is_published', true)
    }

    const { data, error } = await query.maybeSingle()
    if (error) return apiError(error, 400)
    return apiOk(data)
  }

  if (slug) {
    let query = supabaseAdmin
      .from('activity_sessions')
      .select('*')
      .eq('slug', slug)

    // Non-admins can only see published sessions
    if (!userIsAdmin) {
      query = query.eq('is_published', true)
    }

    const { data, error } = await query.single()
    if (error) return apiError(error, 400)
    return apiOk(data)
  }

  if (version_id) {
    let query = supabaseAdmin
      .from('activity_sessions')
      .select('*')
      .eq('activity_version_id', version_id)

    // Non-admins can only see published sessions
    if (!userIsAdmin) {
      query = query.eq('is_published', true)
    }

    const { data, error } = await query.order('session_date', { ascending: false })
    if (error) return apiError(error, 400)
    return apiOk(data ?? [])
  }

  if (type_id) {
    let query = supabaseAdmin
      .from('activity_sessions')
      .select('*')
      .eq('activity_type_id', type_id)

    // Non-admins can only see published sessions
    if (!userIsAdmin) {
      query = query.eq('is_published', true)
    }

    const { data, error } = await query.order('session_date', { ascending: false })
    if (error) return apiError(error, 400)
    return apiOk(data ?? [])
  }

  // No filter — admins get all, non-admins get published only
  let query = supabaseAdmin
    .from('activity_sessions')
    .select('*')

  if (!userIsAdmin) {
    query = query.eq('is_published', true)
  }

  const { data, error } = await query.order('session_date', { ascending: false })
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
    registration_enabled: body.registration_enabled ?? false,
    registration_note: body.registration_note || '',
    event_dates: body.event_dates || [],
    image_display_mode: body.image_display_mode || 'cover',
    reg_status: body.reg_status || null,
    reg_deadline: body.reg_deadline || null,
    notify_publicly: body.notify_publicly ?? false,
  }

  // activity_type_id — সবসময় required
  if (body.activity_type_id || body.type_id) {
    insertData.activity_type_id = body.activity_type_id || body.type_id
  }

  // version optional
  if (body.activity_version_id || body.version_id) {
    const versionId = body.activity_version_id || body.version_id
    const { data: ver, error: verError } = await supabaseAdmin
      .from('activity_versions')
      .select('activity_type_id')
      .eq('id', versionId)
      .single()

    if (verError || !ver) {
      return apiError('Invalid activity_version_id: version does not exist', 400)
    }

    insertData.activity_version_id = versionId
    // version থেকেও type_id নাও যদি না থাকে
    if (!insertData.activity_type_id) {
      insertData.activity_type_id = ver.activity_type_id
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

  if (!id) return apiError('Missing id', 400)

  const updateData: any = { ...rest }
  if (rest.version_id) { updateData.activity_version_id = rest.version_id; delete updateData.version_id }
  if (rest.type_id) { updateData.activity_type_id = rest.type_id; delete updateData.type_id }

  // Validate activity_version_id if being updated
  if (updateData.activity_version_id) {
    const { data: ver, error: verError } = await supabaseAdmin
      .from('activity_versions')
      .select('id')
      .eq('id', updateData.activity_version_id)
      .maybeSingle()

    if (verError || !ver) {
      return apiError('Invalid activity_version_id: version does not exist', 400)
    }
  }

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

  if (!id) return apiError('Missing id', 400)

  const { error } = await supabaseAdmin
    .from('activity_sessions')
    .delete()
    .eq('id', id)
  if (error) return apiError(error, 400)
  return apiOk({ success: true })
}
