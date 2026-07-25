'use client'
import { useParams } from 'next/navigation'
import { FormGraphBuilder } from '@/components/admin/FormGraphBuilder'

// Thin route wrapper — the actual diagram lives in the shared
// FormGraphBuilder component so it can also be embedded as a tab on the
// activity-session and olympiad admin pages.
export default function DiagramPage() {
  const params = useParams()
  const graphId = params.graphId as string
  return <FormGraphBuilder graphId={graphId} />
}
