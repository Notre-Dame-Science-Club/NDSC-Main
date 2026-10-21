import type { OlympiadActivityLink } from '@/lib/server/olympiadActivityLink'

/**
 * Does an activity registration actually belong to the olympiad whose
 * activity link is `link`? The organizer registrations listing selects
 * activity_registrations by `form_node_id = link.category_id`, so scoring must
 * use the same relationship. A missing link (standalone olympiad) or a missing
 * node id never matches.
 */
export function registrationBelongsToLink(
  registrationFormNodeId: string | null | undefined,
  link: Pick<OlympiadActivityLink, 'category_id'> | null | undefined
): boolean {
  if (!link || !registrationFormNodeId) return false
  return registrationFormNodeId === link.category_id
}
