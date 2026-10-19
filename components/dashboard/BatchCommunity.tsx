'use client'
import { useEffect, useState } from 'react'
import { BookOpen, Megaphone, MessageCircle, Phone, Rocket, Users } from 'lucide-react'
import { segmentAuthHeaders } from '@/lib/clientAuthHeaders'
import { BATCH28_ROLL_RE } from '@/lib/batch28'

type Community = {
  eligible: boolean
  whatsapp?: string
  messenger?: string
  organizers?: { name: string; whatsapp: string }[]
}

const EXPECT = [
  { icon: Megaphone, title: 'Club Updates & Announcements', text: "Stay informed about NDSC's activities, events, and upcoming initiatives." },
  { icon: BookOpen, title: 'Learning Resources', text: 'Educational materials, scientific content, and useful resources beyond the classroom.' },
  { icon: Rocket, title: 'Bootcamps & Opportunities', text: 'Updates and links for upcoming bootcamps, learning sessions, and other opportunities.' },
  { icon: Users, title: 'Connect & Collaborate', text: 'Meet fellow science enthusiasts, ask questions, and build connections through free messaging.' },
]

/** "01633031393" -> "8801633031393" for wa.me */
const waNumber = (n: string) => '88' + n.replace(/\D/g, '')

/**
 * Batch 28 (NDC, roll 128xxxxx) only. The links are fetched from /api/batch-community,
 * which re-checks the member's saved roll on the server — so this component renders
 * nothing for anyone else, and the links are never in the page source.
 */
export default function BatchCommunity({ roll, institution }: { roll?: string | null; institution?: string | null }) {
  const [data, setData] = useState<Community | null>(null)
  const cleanRoll = String(roll ?? '').trim()

  useEffect(() => {
    // Cheap client pre-check just to avoid a pointless request; the server is the real gate.
    if (!BATCH28_ROLL_RE.test(cleanRoll)) { setData(null); return }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/batch-community', { headers: await segmentAuthHeaders() })
        if (!res.ok || cancelled) return
        const json = await res.json()
        if (!cancelled) setData(json?.eligible ? json : null)
      } catch { /* the community card is optional; never break the dashboard */ }
    })()
    return () => { cancelled = true }
  }, [cleanRoll, institution])

  if (!data?.eligible) return null

  return (
    <section className="rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(var(--blue-rgb), 0.14), rgba(var(--blue-rgb), 0.03) 55%, var(--bg2))',
        border: '1px solid rgba(var(--blue-rgb), 0.35)',
        backdropFilter: 'blur(10px)',
      }}>
      <div className="p-6 pb-4">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
          style={{ background: 'rgba(var(--blue-rgb), 0.15)', color: 'var(--blue)' }}>
          <Users size={11} /> Batch 28 · Community
        </span>
        <h3 className="text-xl font-bold mt-3" style={{ color: 'var(--white)', fontFamily: 'inherit' }}>
          Welcome to the NDSC Community
        </h3>
        <p className="text-sm mt-2 leading-relaxed" style={{ color: 'var(--muted)' }}>
          Whether you've participated in our events, registered for a competition, are a member of NDSC, or simply
          have a passion for science, we'd love to welcome you. We're building a space where science enthusiasts can
          connect, exchange ideas, and explore opportunities to learn and grow together.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3 px-6">
        {EXPECT.map(e => (
          <div key={e.title} className="flex gap-3 rounded-xl p-3.5"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(var(--blue-rgb), 0.12)' }}>
              <e.icon size={16} style={{ color: 'var(--blue)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--white)' }}>{e.title}</p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--muted)' }}>{e.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-3 p-6 pb-4">
        <a href={data.whatsapp} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl p-4 transition-all hover:-translate-y-0.5"
          style={{ background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.4)' }}>
          <MessageCircle size={22} style={{ color: '#25d366' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--white)' }}>Join WhatsApp Community</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Updates, resources & opportunities</p>
          </div>
        </a>
        <a href={data.messenger} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-xl p-4 transition-all hover:-translate-y-0.5"
          style={{ background: 'rgba(0,132,255,0.12)', border: '1px solid rgba(0,132,255,0.4)' }}>
          <MessageCircle size={22} style={{ color: '#5ab0ff' }} />
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--white)' }}>Join Messenger Group</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Chat freely with fellow members</p>
          </div>
        </a>
      </div>

      <div className="px-6 pb-6">
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
          Need help? Contact an organizer
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          {(data.organizers || []).map(o => (
            <a key={o.name} href={`https://wa.me/${waNumber(o.whatsapp)}`} target="_blank" rel="noopener noreferrer"
              className="rounded-xl p-3.5 transition-all hover:-translate-y-0.5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--white)' }}>{o.name}</p>
              <p className="text-xs mt-1 flex items-center gap-1.5" style={{ color: 'var(--blue)', fontVariantNumeric: 'tabular-nums' }}>
                <Phone size={11} /> {o.whatsapp}
              </p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>WhatsApp</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
