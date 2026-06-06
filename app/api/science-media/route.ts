import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('science_media')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
  if (error) return NextResponse.json([], { status: 200 })
  return NextResponse.json(data || [])
}