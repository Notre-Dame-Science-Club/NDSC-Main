import { supabaseAdmin } from '@/lib/supabase'

import { apiError, apiOk } from '@/lib/api/response'

// Public route — powers the homepage leaderboard widget. Deliberately
// restrictive about what it exposes:
//   - Only pulls from olympiads where result_published = true (an admin's
//     explicit choice — the same flag that gates the student result page).
//   - Only returns name + score + olympiad name, never phone/email/college
//     roll/answer sheets/anything else from the registration row.
//   - Caps to a small number of top scorers per olympiad, and a small number
//     of olympiads overall, since this is a teaser widget, not a full report.
export async function GET() {
  const { data: olympiads, error: olyError } = await supabaseAdmin
    .from('olympiads')
    .select('id, name')
    .eq('result_published', true)
    .order('created_at', { ascending: false })
    .limit(3)

  if (olyError) return apiError(olyError, 400)
  if (!olympiads || olympiads.length === 0) return apiOk({ leaderboards: [] })

  const leaderboards = await Promise.all(
    olympiads.map(async (oly) => {
      const { data: regs } = await supabaseAdmin
        .from('olympiad_registrations')
        .select('full_name, final_score, mcq_score')
        .eq('olympiad_id', oly.id)
        .order('final_score', { ascending: false, nullsFirst: false })
        .limit(5)

      const entries = (regs || [])
        .map(r => ({ name: r.full_name, score: r.final_score ?? r.mcq_score ?? 0 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)

      return { olympiad_id: oly.id, olympiad_name: oly.name, entries }
    })
  )

  return apiOk({ leaderboards: leaderboards.filter(l => l.entries.length > 0) })
}
