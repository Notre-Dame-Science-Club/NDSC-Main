import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'
import { unpackFormConfigRow } from '@/lib/formConfig'

// Public, read-only lookup by form_key — used by the register pages (and
// anywhere else public-facing) to load per-form appearance/field overrides.
// No admin check here: unlike /api/admin/form-configs, an anonymous visitor
// filling out a registration form is exactly who this is for. (This route
// previously required an admin session cookie by mistake — a leftover copy
// of the admin route — which silently blocked every visitor from getting
// their appearance/contact overrides; they'd just see site defaults with no
// visible error.)
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('form_key')
  if (!key) return apiError('form_key is required.', 400)

  const { data, error } = await supabaseAdmin
    .from('form_configs')
    .select('*')
    .eq('form_key', key)
    .maybeSingle()

  if (error) return apiError(error, 400)
  return apiOk({ config: data ? unpackFormConfigRow(data) : null })
}
