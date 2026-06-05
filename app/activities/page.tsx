"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Play, FileText, Mic, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";

type ActivityType = {
  id: string; name: string; slug: string; icon: string;
  description: string; display_order: number;
};
type ActivityVersion = {
  id: string; activity_type_id: string; version_number: number;
  version_label: string; year_start: number; year_end: number | null;
  description: string;
};
type ActivitySession = {
  id: string; activity_version_id: string; activity_type_id: string;
  title: string; slug: string; session_date: string; location: string;
  description: string; cover_image_url: string; youtube_url: string;
  pdf_url: string; gallery_urls: string[]; is_published: boolean;
};

function getYoutubeId(url: string) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  return m ? m[1] : null;
}

/* ── Session Card ─────────────────────────────────────────────── */
function SessionCard({ s }: { s: ActivitySession }) {
  const ytId = getYoutubeId(s.youtube_url);
  const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : s.cover_image_url;
  return (
    <Link href={`/activities/${s.slug}`}
      className="group flex flex-col rounded-2xl border overflow-hidden transition-all duration-300 hover:border-[var(--blue)] hover:-translate-y-1"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <div className="relative overflow-hidden" style={{ height: 200 }}>
        {thumb ? (
          <img src={thumb} alt={s.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl opacity-20"
            style={{ background: "var(--bg2)" }}>📷</div>
        )}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(0deg,rgba(2,8,16,.75) 0%,transparent 60%)" }} />
        {ytId && (
          <div className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,0,0,.8)" }}>
            <Play size={12} fill="white" color="white" />
          </div>
        )}
        {s.pdf_url && (
          <div className="absolute bottom-3 right-3 px-2 py-1 rounded text-xs font-bold flex items-center gap-1"
            style={{ background: "rgba(0,212,255,.85)", color: "#000" }}>
            <FileText size={10} /> PDF
          </div>
        )}
        {s.gallery_urls?.length > 0 && (
          <div className="absolute bottom-3 left-3 px-2 py-1 rounded text-xs font-bold"
            style={{ background: "rgba(46,204,113,.85)", color: "#000" }}>
            🖼 {s.gallery_urls.length}
          </div>
        )}
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <h3 className="font-bold text-sm mb-2 group-hover:text-[var(--blue)] transition-colors line-clamp-2"
          style={{ fontFamily: "'Orbitron',sans-serif" }}>{s.title}</h3>
        {s.description && (
          <p className="text-xs leading-relaxed mb-3 line-clamp-2" style={{ color: "var(--muted)" }}>
            {s.description}
          </p>
        )}
        <div className="mt-auto flex flex-wrap gap-2 text-xs" style={{ color: "var(--muted)" }}>
          {s.session_date && (
            <span>📅 {new Date(s.session_date).toLocaleDateString("en-BD", {
              day: "numeric", month: "short", year: "numeric"
            })}</span>
          )}
          {s.location && <span>📍 {s.location}</span>}
        </div>
      </div>
    </Link>
  );
}

/* ── Version Section ──────────────────────────────────────────── */
function VersionSection({ version, sessions }: { version: ActivityVersion; sessions: ActivitySession[] }) {
  const [open, setOpen] = useState(true);
  const published = sessions
    .filter(s => s.is_published)
    .sort((a, b) => new Date(b.session_date || 0).getTime() - new Date(a.session_date || 0).getTime());

  return (
    <div className="mb-10">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 mb-6 group">
        <div className="flex items-center gap-3 flex-1">
          <div className="px-3 py-1 rounded-lg text-sm font-black"
            style={{ background: "rgba(0,212,255,.15)", color: "var(--blue)", border: "1px solid rgba(0,212,255,.3)", fontFamily: "'Orbitron',sans-serif" }}>
            {version.version_label || `v${version.version_number}`}
          </div>
          <div className="text-left">
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {version.year_start}{version.year_end ? ` – ${version.year_end}` : " – present"}
              {version.description && ` · ${version.description}`}
            </p>
          </div>
        </div>
        <div style={{ color: "var(--muted)" }}>
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {open && (
        published.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {published.map(s => <SessionCard key={s.id} s={s} />)}
          </div>
        ) : (
          <div className="text-center py-10" style={{ color: "var(--muted)" }}>
            <p className="text-sm">No sessions published yet.</p>
          </div>
        )
      )}
      <div className="mt-8 border-b" style={{ borderColor: "var(--border)" }} />
    </div>
  );
}

/* ── Dynamic Activity Tab ─────────────────────────────────────── */
function DynamicActivityTab({ type }: { type: ActivityType }) {
  const [versions, setVersions] = useState<ActivityVersion[]>([]);
  const [sessionMap, setSessionMap] = useState<Record<string, ActivitySession[]>>({});
  const [directSessions, setDirectSessions] = useState<ActivitySession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Load versions
        const vRes = await fetch(`/api/admin/activity-versions?type_id=${type.id}`);
        const vData: ActivityVersion[] = await vRes.json();
        const versions = Array.isArray(vData) ? vData : [];
        setVersions(versions);

        // Load ALL sessions for this type
        const sRes = await fetch(`/api/admin/activity-sessions?type_id=${type.id}`);
        const sData: ActivitySession[] = await sRes.json();
        const allSessions = Array.isArray(sData) ? sData : [];

        // Split: sessions with version vs without version
        const withVersion: Record<string, ActivitySession[]> = {};
        const withoutVersion: ActivitySession[] = [];

        allSessions.forEach(s => {
          if (s.activity_version_id) {
            if (!withVersion[s.activity_version_id]) withVersion[s.activity_version_id] = [];
            withVersion[s.activity_version_id].push(s);
          } else {
            withoutVersion.push(s);
          }
        });

        setSessionMap(withVersion);
        // Sort direct sessions by date desc
        setDirectSessions(withoutVersion.sort((a, b) =>
          new Date(b.session_date || 0).getTime() - new Date(a.session_date || 0).getTime()
        ));
      } catch {}
      setLoading(false);
    };
    load();
  }, [type.id]);

  if (loading) return <div className="text-center py-20" style={{ color: "var(--muted)" }}>Loading...</div>;

  const hasContent = versions.length > 0 || directSessions.length > 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-12">
        <div className="section-label mb-2">{type.icon} Activity</div>
        <h2 className="text-3xl font-black mb-2" style={{ fontFamily: "'Orbitron',sans-serif" }}>
          <span style={{ color: "var(--blue)" }}>{type.name.toUpperCase()}</span>
        </h2>
        {type.description && (
          <p className="text-sm max-w-2xl" style={{ color: "var(--muted)", lineHeight: 1.7 }}>
            {type.description}
          </p>
        )}
      </div>

      {!hasContent ? (
        <div className="text-center py-24">
          <p className="text-5xl mb-4">{type.icon}</p>
          <p className="text-sm" style={{ color: "var(--muted)" }}>No sessions yet. Check back soon!</p>
        </div>
      ) : (
        <>
          {/* Versioned sessions — latest version first */}
          {versions
            .sort((a, b) => b.version_number - a.version_number)
            .map(v => (
              <VersionSection key={v.id} version={v} sessions={sessionMap[v.id] || []} />
            ))
          }

          {/* Direct sessions (no version) */}
          {directSessions.filter(s => s.is_published).length > 0 && (
            <div>
              {versions.length > 0 && (
                <h3 className="text-lg font-bold mb-6" style={{ fontFamily: "'Orbitron',sans-serif", color: "var(--muted)" }}>
                  Other Sessions
                </h3>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {directSessions.filter(s => s.is_published).map(s => (
                  <SessionCard key={s.id} s={s} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────── */
function ActivitiesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "");
  const [types, setTypes] = useState<ActivityType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  useEffect(() => {
    fetch("/api/admin/activity-types")
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          // Sort by display_order
          const sorted = d.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
          setTypes(sorted);
          if (!searchParams.get("tab") && sorted.length > 0) {
            setActiveTab(sorted[0].slug);
          }
        }
      })
      .finally(() => setLoadingTypes(false));
  }, []);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t) setActiveTab(t);
  }, [searchParams]);

  const switchTab = (id: string) => {
    setActiveTab(id);
    router.push(`/activities?tab=${id}`, { scroll: false });
  };

  const activeType = types.find(t => t.slug === activeTab);

  return (
    <>
      {/* Tabs */}
      <div className="sticky z-30 border-b overflow-x-auto"
        style={{ top: "64px", background: "rgba(2,8,16,.97)", borderColor: "var(--border)", backdropFilter: "blur(12px)" }}>
        <div className="flex gap-2 px-4 sm:px-6 py-3 min-w-max">
          {loadingTypes ? (
            <div className="px-3 py-1.5 text-xs" style={{ color: "var(--muted)" }}>Loading...</div>
          ) : (
            types.map(t => (
              <button key={t.id} onClick={() => switchTab(t.slug)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black tracking-wider rounded-lg border transition-all whitespace-nowrap"
                style={{
                  fontFamily: "'Orbitron',sans-serif",
                  background: activeTab === t.slug ? "var(--blue)" : "transparent",
                  color: activeTab === t.slug ? "#000" : "var(--muted)",
                  borderColor: activeTab === t.slug ? "var(--blue)" : "var(--border)",
                }}>
                <span>{t.icon}</span> {t.name}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        {activeType ? (
          <DynamicActivityTab key={activeType.id} type={activeType} />
        ) : !loadingTypes ? (
          <div className="text-center py-24" style={{ color: "var(--muted)" }}>
            <p className="text-5xl mb-4">🔬</p>
            <p>Select an activity tab above.</p>
          </div>
        ) : null}
      </div>
    </>
  );
}

export default function ActivitiesPage() {
  return (
    <div className="min-h-screen relative z-10" style={{ paddingTop: "72px" }}>
      <div className="py-16 text-center border-b"
        style={{ background: "linear-gradient(180deg,var(--bg2),var(--bg))", borderColor: "var(--border)" }}>
        <div className="section-label justify-center mb-2">Explore</div>
        <h1 className="text-4xl md:text-5xl font-black" style={{ fontFamily: "'Orbitron',sans-serif" }}>
          ALL <span style={{ color: "var(--blue)" }}>ACTIVITIES</span>
        </h1>
      </div>
      <Suspense fallback={<div className="text-center py-20" style={{ color: "var(--muted)" }}>Loading...</div>}>
        <ActivitiesContent />
      </Suspense>
    </div>
  );
}
