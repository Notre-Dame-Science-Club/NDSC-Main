'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Tab = 'home' | 'activities' | 'publications' | 'olympiads' | 'profile'

export default function DashboardPage() {
  const router = useRouter()
  const [member, setMember] = useState<any>(null)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [publications, setPublications] = useState<any[]>([])
  const [olympiads, setOlympiads] = useState<any[]>([])
  const [tab, setTab] = useState<Tab>('home')
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    const load = async () => {
      // Auth check
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (!user || userError) {
        router.replace('/login')
        return
      }
      setAuthChecked(true)

      // Load member profile
      const { data: m } = await supabase
        .from('members')
        .select('*')
        .eq('id', user.id)
        .single()

      setMember(m || { email: user.email, full_name: user.email })

      // Load public content (these should work without RLS issues)
      const [{ data: a }, { data: act }, { data: pub }, { data: oly }] = await Promise.all([
        supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('activities').select('*').eq('is_published', true).order('date', { ascending: false }).limit(10),
        supabase.from('publications').select('*').eq('is_published', true).order('created_at', { ascending: false }),
        supabase.from('olympiads').select('*').eq('is_active', true).order('exam_date', { ascending: true }),
      ])

      setAnnouncements(a || [])
      setActivities(act || [])
      setPublications(pub || [])
      setOlympiads(oly || [])
      setLoading(false)
    }
    load()
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'home', label: 'Home', icon: '🏠' },
    { key: 'activities', label: 'Activities', icon: '📅' },
    { key: 'publications', label: 'Publications', icon: '📚' },
    { key: 'olympiads', label: 'Olympiads', icon: '🏆' },
    { key: 'profile', label: 'Profile', icon: '👤' },
  ]

  const activityTypeColors: Record<string, string> = {
    workshops: 'bg-purple-100 text-purple-700',
    events: 'bg-blue-100 text-blue-700',
    podcast: 'bg-green-100 text-green-700',
    science_sunday: 'bg-yellow-100 text-yellow-700',
    stem_insights: 'bg-orange-100 text-orange-700',
    projects: 'bg-red-100 text-red-700',
  }

  if (!authChecked || loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="text-center">
        <div className="inline-block w-10 h-10 rounded-full border-2 border-t-transparent animate-spin mb-3"
          style={{ borderColor: 'var(--blue)', borderTopColor: 'transparent' }} />
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="text-white px-6 py-4 flex justify-between items-center sticky top-0 z-10"
        style={{ background: '#0a1628', borderBottom: '1px solid var(--border)' }}>
        <div>
          <h1 className="text-base font-bold" style={{ fontFamily: "'Orbitron', sans-serif", color: 'var(--blue)' }}>
            NDSC Member Portal
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{member?.full_name || member?.email}</p>
        </div>
        <button onClick={logout}
          className="text-sm px-4 py-1.5 rounded-lg transition-colors border"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          onMouseEnter={e => { (e.target as HTMLElement).style.color = '#ff7070'; (e.target as HTMLElement).style.borderColor = '#ff7070' }}
          onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--muted)'; (e.target as HTMLElement).style.borderColor = 'var(--border)' }}>
          Logout
        </button>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto sticky top-[60px] z-10"
        style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex items-center gap-1.5 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors"
            style={{
              borderColor: tab === t.key ? 'var(--blue)' : 'transparent',
              color: tab === t.key ? 'var(--blue)' : 'var(--muted)',
            }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div className="max-w-3xl mx-auto p-5 pb-16">

        {/* HOME */}
        {tab === 'home' && (
          <div className="space-y-4">
            <div className="rounded-2xl p-6"
              style={{ background: 'linear-gradient(135deg, #0a1f3d, #0d2a50)', border: '1px solid var(--border)' }}>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>Welcome back,</p>
              <h2 className="text-2xl font-bold mt-1" style={{ color: 'var(--white)' }}>{member?.full_name}</h2>
              <div className="flex gap-3 mt-4 flex-wrap">
                {member?.ndsc_id && (
                  <span className="text-xs px-3 py-1 rounded-full"
                    style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: 'var(--blue)' }}>
                    ID: {member.ndsc_id}
                  </span>
                )}
                {member?.batch && (
                  <span className="text-xs px-3 py-1 rounded-full"
                    style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: 'var(--blue)' }}>
                    Batch: {member.batch}
                  </span>
                )}
              </div>
            </div>

            <h3 className="font-semibold text-sm mt-2" style={{ color: 'var(--muted)', fontFamily: "'Orbitron', sans-serif" }}>
              📢 Announcements
            </h3>
            {announcements.length === 0
              ? <p className="text-sm" style={{ color: 'var(--muted)' }}>No announcements yet.</p>
              : announcements.map(a => (
                <div key={a.id} className="rounded-xl p-4"
                  style={{ background: 'var(--bg2)', borderLeft: '3px solid var(--blue)', border: '1px solid var(--border)', borderLeftWidth: '3px', borderLeftColor: 'var(--blue)' }}>
                  <p className="font-semibold text-sm" style={{ color: 'var(--white)' }}>{a.title}</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{a.body}</p>
                  <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
                    {new Date(a.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>
              ))
            }
          </div>
        )}

        {/* ACTIVITIES */}
        {tab === 'activities' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--muted)', fontFamily: "'Orbitron', sans-serif" }}>All Activities</h3>
            {activities.length === 0
              ? <p className="text-sm" style={{ color: 'var(--muted)' }}>No activities published yet.</p>
              : activities.map(a => (
                <div key={a.id} className="rounded-xl overflow-hidden"
                  style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                  {a.banner_url && (
                    <img src={a.banner_url} alt={a.title} className="w-full h-40 object-cover" />
                  )}
                  <div className="p-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${activityTypeColors[a.activities_type] || 'bg-gray-100 text-gray-600'}`}>
                      {a.activities_type?.replace('_', ' ').toUpperCase()}
                    </span>
                    <h4 className="font-semibold mt-2" style={{ color: 'var(--white)' }}>{a.title}</h4>
                    <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{a.description}</p>
                    <div className="flex items-center justify-between mt-3">
                      <div className="text-xs space-y-0.5" style={{ color: 'var(--muted)' }}>
                        {a.date && <p>📆 {new Date(a.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>}
                        {a.location && <p>📍 {a.location}</p>}
                      </div>
                      {a.registration_link && (
                        <a href={a.registration_link} target="_blank"
                          className="text-xs px-4 py-1.5 rounded-lg text-black font-semibold"
                          style={{ background: 'var(--blue)' }}>
                          Register
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* PUBLICATIONS */}
        {tab === 'publications' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--muted)', fontFamily: "'Orbitron', sans-serif" }}>Publications</h3>
            {publications.length === 0
              ? <p className="text-sm" style={{ color: 'var(--muted)' }}>No publications available yet.</p>
              : publications.map(p => (
                <div key={p.id} className="rounded-xl p-4 flex gap-4"
                  style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                  {p.cover_image_url
                    ? <img src={p.cover_image_url} alt={p.title} className="w-16 h-20 object-cover rounded-lg flex-shrink-0" />
                    : <div className="w-16 h-20 rounded-lg flex items-center justify-center flex-shrink-0 text-2xl"
                        style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid var(--border)' }}>📄</div>
                  }
                  <div className="flex-1 min-w-0">
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(0,212,255,0.1)', color: 'var(--blue)' }}>
                      {p.category} {p.published_year && `· ${p.published_year}`}
                    </span>
                    <h4 className="font-semibold mt-1 truncate" style={{ color: 'var(--white)' }}>{p.title}</h4>
                    <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--muted)' }}>{p.description}</p>
                    {p.pdf_url && (
                      <a href={p.pdf_url} target="_blank"
                        className="inline-block mt-2 text-xs font-medium hover:underline"
                        style={{ color: 'var(--blue)' }}>
                        Download PDF →
                      </a>
                    )}
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* OLYMPIADS */}
        {tab === 'olympiads' && (
          <div className="space-y-4">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--muted)', fontFamily: "'Orbitron', sans-serif" }}>Active Olympiads</h3>
            {olympiads.length === 0
              ? <p className="text-sm" style={{ color: 'var(--muted)' }}>No active olympiads at the moment.</p>
              : olympiads.map(o => (
                <div key={o.id} className="rounded-xl p-5"
                  style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                  <h4 className="font-bold text-lg" style={{ color: 'var(--white)' }}>{o.name}</h4>
                  <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{o.description}</p>
                  <div className="mt-3 space-y-1.5 text-sm" style={{ color: 'var(--muted)' }}>
                    {o.registration_deadline && (
                      <p>📝 Deadline: <span style={{ color: 'var(--white)' }}>
                        {new Date(o.registration_deadline).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span></p>
                    )}
                    {o.exam_date && (
                      <p>📆 Exam: <span style={{ color: 'var(--white)' }}>
                        {new Date(o.exam_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span></p>
                    )}
                    {o.eligibility && <p>✅ Eligibility: {o.eligibility}</p>}
                  </div>
                  {o.pdf_url && (
                    <a href={o.pdf_url} target="_blank"
                      className="inline-block mt-3 text-sm px-4 py-2 rounded-lg text-black font-semibold"
                      style={{ background: 'var(--blue)' }}>
                      View Details PDF
                    </a>
                  )}
                </div>
              ))
            }
          </div>
        )}

        {/* PROFILE */}
        {tab === 'profile' && (
          <div className="rounded-xl p-6" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
                style={{ background: 'rgba(0,212,255,0.1)', border: '2px solid rgba(0,212,255,0.3)', color: 'var(--blue)' }}>
                {member?.full_name?.[0] || '?'}
              </div>
              <div>
                <h2 className="font-bold text-lg" style={{ color: 'var(--white)' }}>{member?.full_name || '—'}</h2>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>{member?.email}</p>
              </div>
            </div>
            <div className="space-y-0">
              {[
                { label: 'NDSC ID', value: member?.ndsc_id },
                { label: 'Phone', value: member?.phone },
                { label: 'College Roll', value: member?.college_role },
                { label: 'Batch', value: member?.batch },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center py-3"
                  style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>{row.label}</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--white)' }}>{row.value || '—'}</span>
                </div>
              ))}
            </div>
            <button onClick={logout}
              className="mt-6 w-full py-2.5 rounded-lg text-sm border transition-colors"
              style={{ borderColor: 'rgba(255,80,80,0.4)', color: '#ff7070' }}>
              Sign Out
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
