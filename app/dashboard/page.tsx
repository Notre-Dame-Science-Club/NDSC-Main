'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MessageCircle, Award, Plus, Upload, X } from 'lucide-react'

type Tab = 'home' | 'activities' | 'publications' | 'olympiads' | 'profile'
type Achievement = { id: string; title: string; description?: string; image_url?: string; status: 'pending' | 'approved'; created_at: string }

export default function DashboardPage() {
  const router = useRouter()
  const [member, setMember] = useState<any>(null)
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [myRegistrations, setMyRegistrations] = useState<any[]>([])
  const [regsLoading, setRegsLoading] = useState(false)
  const [publications, setPublications] = useState<any[]>([])
  const [olympiads, setOlympiads] = useState<any[]>([])
  const [messengerLink, setMessengerLink] = useState('')
  const [shoutPosts, setShoutPosts] = useState<{ id: string; full_name: string; message: string; created_at: string }[]>([])
  const [shoutMessage, setShoutMessage] = useState('')
  const [shoutPosting, setShoutPosting] = useState(false)
  const [shoutError, setShoutError] = useState('')
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

      // Load member's event registrations
      if (m?.id) {
        setRegsLoading(true)
        fetch(`/api/member-activity-registrations?member_id=${m.id}`)
          .then(r => r.json())
          .then(d => setMyRegistrations(d.registrations || []))
          .catch(() => {})
          .finally(() => setRegsLoading(false))
      }

      // Load public content (these should work without RLS issues)
      const [{ data: a }, allActivities, { data: pub }, { data: oly }, settingsRes] = await Promise.all([
        supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(5),
        // NOTE: this previously queried a table literally named `activities`
        // with a `date` column — that table doesn't exist (it's dead/legacy
        // code from before the Type→Version→Session activity system was
        // built); the real table is `activity_sessions`. This means the
        // dashboard's Activities tab was never actually showing real data.
        // Fixed by using the same public route the real /activities page
        // itself relies on.
        fetch('/api/activity-sessions-public').then(r => r.json()).catch(() => []),
        supabase.from('publications').select('*').eq('is_published', true).order('created_at', { ascending: false }),
        supabase.from('olympiads').select('*').eq('is_active', true).order('exam_date', { ascending: true }),
        fetch('/api/admin/homepage-settings').catch(() => null),
      ])

      setAnnouncements(a || [])
      setActivities(Array.isArray(allActivities) ? allActivities : [])
      setPublications(pub || [])
      setOlympiads(oly || [])
      if (settingsRes && settingsRes.ok) {
        const settings = await settingsRes.json()
        setMessengerLink(settings.messenger_group_link || '')
      }
      setLoading(false)
      loadShoutbox()
    }
    load()
  }, [])

  const loadShoutbox = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    try {
      const res = await fetch('/api/member-shoutbox', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) { const data = await res.json(); setShoutPosts(data.posts || []) }
    } catch { /* feed is non-critical, fail silently */ }
  }

  const postShout = async () => {
    if (!shoutMessage.trim()) return
    setShoutPosting(true)
    setShoutError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Your session has expired. Please log in again.')
      const res = await fetch('/api/member-shoutbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ message: shoutMessage.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not post. Please try again.')
      setShoutPosts(prev => [data.post, ...prev])
      setShoutMessage('')
    } catch (e: any) {
      setShoutError(e.message || 'Something went wrong.')
    } finally {
      setShoutPosting(false)
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Achievement form state
  const [showAchievementForm, setShowAchievementForm] = useState(false)
  const [achTitle, setAchTitle] = useState('')
  const [achDesc, setAchDesc] = useState('')
  const [achImage, setAchImage] = useState<File | null>(null)
  const [achSubmitting, setAchSubmitting] = useState(false)
  const [achError, setAchError] = useState('')

  // Profile self-edit state
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState<any>({})
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')

  const saveProfile = async () => {
    if (!profileForm.full_name?.trim()) { setProfileError('Name cannot be empty.'); return }
    setProfileSaving(true)
    setProfileError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Your session has expired. Please log in again.')
      const res = await fetch('/api/member-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(profileForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save changes.')
      setMember((prev: any) => ({ ...prev, ...profileForm }))
      setEditingProfile(false)
    } catch (e: any) {
      setProfileError(e.message || 'Something went wrong.')
    } finally {
      setProfileSaving(false)
    }
  }

  const uploadAchievementImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'achievements')
      const xhr = new XMLHttpRequest()
      xhr.addEventListener('load', () => {
        try {
          const data = JSON.parse(xhr.responseText)
          if (xhr.status >= 200 && xhr.status < 300 && data.url) resolve(data.url)
          else reject(new Error(data.error || 'Upload failed'))
        } catch { reject(new Error('Upload failed. Please try again.')) }
      })
      xhr.addEventListener('error', () => reject(new Error('Network error during upload.')))
      xhr.open('POST', '/api/member-upload')
      xhr.send(fd)
    })
  }

  const submitAchievement = async () => {
    if (!achTitle.trim()) { setAchError('Please enter a title.'); return }
    setAchSubmitting(true)
    setAchError('')
    try {
      let image_url: string | undefined
      if (achImage) image_url = await uploadAchievementImage(achImage)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Your session has expired. Please log in again.')
      const res = await fetch('/api/member-achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ title: achTitle.trim(), description: achDesc.trim() || undefined, image_url }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save achievement.')
      setMember((prev: any) => ({ ...prev, achievements: data.achievements }))
      setAchTitle(''); setAchDesc(''); setAchImage(null); setShowAchievementForm(false)
    } catch (e: any) {
      setAchError(e.message || 'Something went wrong.')
    } finally {
      setAchSubmitting(false)
    }
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'home', label: 'Home', icon: '🏠' },
    { key: 'activities', label: 'Activities', icon: '📅' },
    { key: 'publications', label: 'Publications', icon: '📚' },
    { key: 'olympiads', label: 'Olympiads', icon: '🏆' },
    { key: 'profile', label: 'Profile', icon: '👤' },
  ]

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
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div>
          <h1 className="text-base font-bold" style={{ fontFamily: "'Orbitron', sans-serif", color: 'var(--blue)' }}>
            NDSC Member Portal
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{member?.full_name || member?.email}</p>
        </div>
        <button onClick={logout}
          className="text-sm px-4 py-1.5 rounded-lg transition-colors border"
          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--danger-soft)'; (e.target as HTMLElement).style.borderColor = 'var(--danger-soft)' }}
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
                    style={{ background: 'rgba(var(--blue-rgb), 0.1)', border: '1px solid rgba(var(--blue-rgb), 0.3)', color: 'var(--blue)' }}>
                    ID: {member.ndsc_id}
                  </span>
                )}
                {member?.department && (
                  <span className="text-xs px-3 py-1 rounded-full"
                    style={{ background: 'rgba(var(--blue-rgb), 0.1)', border: '1px solid rgba(var(--blue-rgb), 0.3)', color: 'var(--blue)' }}>
                    {member.department}
                  </span>
                )}
                {member?.batch && (
                  <span className="text-xs px-3 py-1 rounded-full"
                    style={{ background: 'rgba(var(--blue-rgb), 0.1)', border: '1px solid rgba(var(--blue-rgb), 0.3)', color: 'var(--blue)' }}>
                    Batch: {member.batch}
                  </span>
                )}
              </div>
            </div>

            {messengerLink && (
              <a href={messengerLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-xl p-4 transition-all hover:-translate-y-0.5"
                style={{ background: 'rgba(0,132,255,0.1)', border: '1px solid rgba(0,132,255,0.3)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(0,132,255,0.2)' }}>
                  <MessageCircle size={18} style={{ color: '#5ab0ff' }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: 'var(--white)' }}>Join the Members' Messenger Group</p>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Stay in the loop with announcements and club life</p>
                </div>
              </a>
            )}

            <h3 className="font-semibold text-sm mt-2" style={{ color: 'var(--muted)', fontFamily: "'Orbitron', sans-serif" }}>
              📢 Updates
            </h3>
            {announcements.length === 0 && olympiads.length === 0 && activities.filter(a => a.registration_enabled).length === 0
              ? <p className="text-sm" style={{ color: 'var(--muted)' }}>No updates yet — check back soon.</p>
              : (
                <>
                  {announcements.map(a => (
                    <div key={a.id} className="rounded-xl p-4"
                      style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderLeftWidth: '3px', borderLeftColor: 'var(--blue)' }}>
                      <p className="font-semibold text-sm" style={{ color: 'var(--white)' }}>{a.title}</p>
                      <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{a.body}</p>
                      <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
                        {new Date(a.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  ))}
                  {olympiads.slice(0, 3).map(o => (
                    <Link key={`oly-${o.id}`} href={`/olympiad?id=${o.id}`} className="block rounded-xl p-4 transition-transform hover:-translate-y-0.5"
                      style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderLeftWidth: '3px', borderLeftColor: 'var(--warning)' }}>
                      <p className="font-semibold text-sm" style={{ color: 'var(--white)' }}>🏆 {o.name} is open</p>
                      <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                        {o.registration_deadline
                          ? `Register before ${new Date(o.registration_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                          : 'Registration is currently open.'}
                      </p>
                    </Link>
                  ))}
                  {activities.filter(a => a.registration_enabled).slice(0, 3).map(a => (
                    <Link key={`act-${a.id}`} href={`/activities/${a.slug}`} className="block rounded-xl p-4 transition-transform hover:-translate-y-0.5"
                      style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderLeftWidth: '3px', borderLeftColor: 'var(--cat-teal)' }}>
                      <p className="font-semibold text-sm" style={{ color: 'var(--white)' }}>📅 {a.title} — registration open</p>
                      {a.registration_note && <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{a.registration_note}</p>}
                    </Link>
                  ))}
                </>
              )
            }

            {/* SHOUTBOX */}
            <h3 className="font-semibold text-sm mt-6 flex items-center gap-2" style={{ color: 'var(--muted)', fontFamily: "'Orbitron', sans-serif" }}>
              💬 Members' Shoutbox
            </h3>
            <div className="rounded-xl p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="flex gap-2 mb-3">
                <input value={shoutMessage} onChange={e => setShoutMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !shoutPosting) postShout() }}
                  placeholder="Share something with the club..." maxLength={500}
                  className="flex-1 px-3 py-2 rounded-lg text-sm outline-none border"
                  style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'var(--border)', color: 'var(--white)' }} />
                <button onClick={postShout} disabled={shoutPosting || !shoutMessage.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-black disabled:opacity-40"
                  style={{ background: 'var(--blue)' }}>
                  {shoutPosting ? '...' : 'Post'}
                </button>
              </div>
              {shoutError && <p className="text-xs mb-2" style={{ color: 'var(--danger-soft)' }}>{shoutError}</p>}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {shoutPosts.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>No posts yet — be the first to say something!</p>
                ) : shoutPosts.map(p => (
                  <div key={p.id} className="text-sm pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
                    <span className="font-semibold" style={{ color: 'var(--blue)' }}>{p.full_name}</span>
                    <span className="ml-2" style={{ color: 'var(--white)' }}>{p.message}</span>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      {new Date(p.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ACTIVITIES */}
        {tab === 'activities' && (
          <div className="space-y-6">

            {/* ── My Registrations ─────────────────────────────────── */}
            <div>
              <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--muted)', fontFamily: "'Orbitron', sans-serif" }}>
                🎫 My Registrations
              </h3>
              {regsLoading ? (
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading your registrations…</p>
              ) : myRegistrations.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--muted)' }}>You haven't registered for any events yet.</p>
              ) : (
                <div className="space-y-3">
                  {myRegistrations.map(reg => (
                    <div key={reg.id} className="rounded-xl p-4 flex items-start justify-between gap-3"
                      style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: 'var(--white)' }}>
                          {reg.session?.title || 'Event'}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                          {reg.category?.name}
                          {reg.project_name && <span style={{ color: 'var(--blue)' }}> — {reg.project_name}</span>}
                        </p>
                        <div className="flex gap-2 mt-1.5 flex-wrap">
                          {reg.category?.schedule_date && (
                            <span className="text-xs" style={{ color: 'var(--cat-teal)' }}>
                              📅 {new Date(reg.category.schedule_date).toLocaleDateString('en-BD', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                          {reg.payment_status && reg.payment_status !== 'not_required' && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{
                              background: reg.payment_status === 'paid' ? 'rgba(var(--success-rgb), 0.1)' : 'rgba(var(--warning-rgb), 0.1)',
                              color: reg.payment_status === 'paid' ? 'var(--success)' : 'var(--warning)',
                            }}>
                              💳 {reg.payment_status}
                            </span>
                          )}
                          {reg.category?.is_online_submission && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>
                              🔗 Online round
                            </span>
                          )}
                        </div>
                      </div>
                      {reg.session?.slug && (
                        <Link href={`/activities/${reg.session.slug}/dashboard?reg=${reg.id}`}
                          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold"
                          style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)', whiteSpace: 'nowrap' }}>
                          Dashboard →
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── All Activities ────────────────────────────────────── */}
            <div>
              <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--muted)', fontFamily: "'Orbitron', sans-serif" }}>
                📅 All Activities
              </h3>
              {activities.length === 0
                ? <p className="text-sm" style={{ color: 'var(--muted)' }}>No activities published yet.</p>
                : activities.map(a => (
                  <Link key={a.id} href={`/activities/${a.slug}`} className="block rounded-xl overflow-hidden transition-transform hover:-translate-y-0.5 mb-3"
                    style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                    {a.cover_image_url && (
                      <img src={a.cover_image_url} alt={a.title} className="w-full h-40 object-cover" />
                    )}
                    <div className="p-4 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {a.activity_types?.name && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>
                            {a.activity_types.name}
                          </span>
                        )}
                        <h4 className="font-semibold mt-2 truncate" style={{ color: 'var(--white)' }}>{a.title}</h4>
                        {a.session_date && (
                          <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                            📆 {new Date(a.session_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                        )}
                      </div>
                      {/* If member already registered for this session, show dashboard link */}
                      {myRegistrations.find(r => r.session?.id === a.id) && (
                        <span className="text-xs px-2 py-1 rounded-full flex-shrink-0" style={{ background: 'rgba(var(--cat-teal-rgb), 0.1)', color: 'var(--cat-teal)' }}>
                          ✓ Registered
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
            </div>

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
                        style={{ background: 'rgba(var(--blue-rgb), 0.08)', border: '1px solid var(--border)' }}>📄</div>
                  }
                  <div className="flex-1 min-w-0">
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>
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
          <div className="space-y-4">
            <div className="rounded-xl p-6" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
                  style={{ background: 'rgba(var(--blue-rgb), 0.1)', border: '2px solid rgba(var(--blue-rgb), 0.3)', color: 'var(--blue)' }}>
                  {member?.full_name?.[0] || '?'}
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-lg" style={{ color: 'var(--white)' }}>{member?.full_name || '—'}</h2>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>{member?.email}</p>
                  {member?.department && (
                    <span className="inline-block mt-1.5 text-xs px-2.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(var(--blue-rgb), 0.1)', border: '1px solid rgba(var(--blue-rgb), 0.3)', color: 'var(--blue)' }}>
                      {member.department} Department
                    </span>
                  )}
                </div>
                {!editingProfile && (
                  <button onClick={() => { setEditingProfile(true); setProfileForm({ full_name: member?.full_name || '', phone: member?.phone || '', college_roll: member?.college_roll || '', batch: member?.batch || '' }) }}
                    className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0" style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>
                    Edit
                  </button>
                )}
              </div>

              {editingProfile ? (
                <div className="space-y-2 mb-4">
                  <input value={profileForm.full_name} onChange={e => setProfileForm((p: any) => ({ ...p, full_name: e.target.value }))}
                    placeholder="Full name" className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
                    style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'var(--border)', color: 'var(--white)' }} />
                  <input value={profileForm.phone} onChange={e => setProfileForm((p: any) => ({ ...p, phone: e.target.value }))}
                    placeholder="Phone" className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
                    style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'var(--border)', color: 'var(--white)' }} />
                  <input value={profileForm.college_roll} onChange={e => setProfileForm((p: any) => ({ ...p, college_roll: e.target.value }))}
                    placeholder="College roll" className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
                    style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'var(--border)', color: 'var(--white)' }} />
                  <input value={profileForm.batch} onChange={e => setProfileForm((p: any) => ({ ...p, batch: e.target.value }))}
                    placeholder="Batch" className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
                    style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'var(--border)', color: 'var(--white)' }} />
                  {profileError && <p className="text-xs" style={{ color: 'var(--danger-soft)' }}>{profileError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button onClick={saveProfile} disabled={profileSaving}
                      className="flex-1 py-2 rounded-lg text-sm font-bold text-black disabled:opacity-50" style={{ background: 'var(--blue)' }}>
                      {profileSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => { setEditingProfile(false); setProfileError('') }} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--muted)' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-0">
                  {[
                    { label: 'NDSC ID', value: member?.ndsc_id },
                    { label: 'Phone', value: member?.phone },
                    { label: 'College Roll', value: member?.college_roll },
                    { label: 'Batch', value: member?.batch },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between items-center py-3"
                      style={{ borderBottom: '1px solid var(--border)' }}>
                      <span className="text-sm" style={{ color: 'var(--muted)' }}>{row.label}</span>
                      <span className="text-sm font-medium" style={{ color: 'var(--white)' }}>{row.value || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={logout}
                className="mt-6 w-full py-2.5 rounded-lg text-sm border transition-colors"
                style={{ borderColor: 'rgba(var(--danger-rgb), 0.4)', color: 'var(--danger-soft)' }}>
                Sign Out
              </button>
            </div>

            {/* ACHIEVEMENTS */}
            <div className="rounded-xl p-6" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: 'var(--muted)', fontFamily: "'Orbitron', sans-serif" }}>
                  <Award size={15} /> Achievements
                </h3>
                <button onClick={() => setShowAchievementForm(v => !v)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-semibold"
                  style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}>
                  <Plus size={13} /> Add
                </button>
              </div>

              {showAchievementForm && (
                <div className="rounded-lg p-4 mb-4 space-y-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <input value={achTitle} onChange={e => setAchTitle(e.target.value)} placeholder="Title — e.g. 1st Place, National ICT Fair 2025"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
                    style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'var(--border)', color: 'var(--white)' }} />
                  <textarea rows={2} value={achDesc} onChange={e => setAchDesc(e.target.value)} placeholder="Short description (optional)"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none border resize-none"
                    style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'var(--border)', color: 'var(--white)' }} />
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border cursor-pointer w-fit"
                    style={{ borderColor: 'var(--border)', color: 'var(--blue)' }}>
                    <Upload size={13} />
                    {achImage ? achImage.name : 'Attach a photo (optional)'}
                    <input type="file" accept="image/*" className="hidden" onChange={e => setAchImage(e.target.files?.[0] || null)} />
                  </label>
                  {achError && <p className="text-xs" style={{ color: 'var(--danger-soft)' }}>{achError}</p>}
                  <div className="flex gap-2">
                    <button onClick={submitAchievement} disabled={achSubmitting}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold text-black disabled:opacity-50"
                      style={{ background: 'var(--blue)' }}>
                      {achSubmitting ? 'Saving...' : 'Submit for review'}
                    </button>
                    <button onClick={() => setShowAchievementForm(false)} className="px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--muted)' }}>
                      <X size={15} />
                    </button>
                  </div>
                </div>
              )}

              {(member?.achievements || []).length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  No achievements added yet — share your awards, certificates, or accomplishments.
                </p>
              ) : (
                <div className="space-y-2">
                  {(member.achievements as Achievement[]).map(a => (
                    <div key={a.id} className="flex items-start gap-3 rounded-lg p-3" style={{ background: 'var(--bg)' }}>
                      {a.image_url && <img src={a.image_url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />}
                      <div className="flex-1">
                        <p className="text-sm font-medium" style={{ color: 'var(--white)' }}>{a.title}</p>
                        {a.description && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{a.description}</p>}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{
                          background: a.status === 'approved' ? 'rgba(var(--success-rgb), 0.1)' : 'rgba(255,165,0,0.1)',
                          color: a.status === 'approved' ? 'var(--success)' : 'var(--warning)',
                        }}>
                        {a.status === 'approved' ? 'Approved' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
