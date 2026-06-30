import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/form-config?form_key=xxx
// Public endpoint — used by registration pages to load form customization.
// Falls back to global key if per-event key not found.
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('form_key')
  if (!key) return NextResponse.json({ config: null })

  // Try exact key first (e.g. 'activity_register:SESSION_ID')
  const { data: exact } = await supabaseAdmin
    .from('form_configs')
    .select('*')
    .eq('form_key', key)
    .maybeSingle()

  if (exact) return NextResponse.json({ config: exact })

  // Fallback to global key (e.g. 'activity_register')
  const globalKey = key.split(':')[0]
  if (globalKey !== key) {
    const { data: global } = await supabaseAdmin
      .from('form_configs')
      .select('*')
      .eq('form_key', globalKey)
      .maybeSingle()
    if (global) return NextResponse.json({ config: global })
  }

  return NextResponse.json({ config: null })
}
