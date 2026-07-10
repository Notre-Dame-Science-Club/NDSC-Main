'use client'
import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import SurveyForm from '@/components/SurveyForm'

export default function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: 'var(--bg)', paddingTop: '96px' }}>
      <div className="max-w-xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs mb-6" style={{ color: 'var(--muted)' }}>
          <ArrowLeft size={14} /> Back to home
        </Link>
        <div className="rounded-2xl border p-6 sm:p-8" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
          <SurveyForm surveyId={id} />
        </div>
      </div>
    </div>
  )
}
