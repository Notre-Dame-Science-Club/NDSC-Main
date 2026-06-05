import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const { data, error } = await supabase
    .from('activity_types')
    .select('name, slug, icon')
    .order('display_order', { ascending: true })

  if (error) return NextResponse.json([], { status: 200 })
  return NextResponse.json(data || [])
}
