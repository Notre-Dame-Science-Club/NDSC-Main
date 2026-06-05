"use client";
import { useState, useEffect, useMemo } from "react";

type Executive = {
  id: string;
  full_name: string;
  position: string;
  panel: string;
  dept: string;
  photo_url: string;
  facebook_url: string;
  linkedin_url: string;
  email: string;
  whatsapp: string;
  instagram_url: string;
  display_order: number;
  session_year: string;
  is_active: boolean;
};

/* ── Social Icons ─────────────────────────────────────────────── */
const FbIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);
const IgIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="2" width="20" height="20" rx="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);
const LiIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);
const WaIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.5 14.4c-.3-.1-1.7-.9-2-.9-.3-.1-.5-.1-.7.2-.2.3-.7.9-.8 1.1-.2.2-.3.2-.6 0-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.6c.1-.2.1-.3.2-.5 0-.2 0-.4-.1-.5-.1-.2-.6-1.6-.9-2.1-.2-.5-.5-.4-.7-.4h-.6c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.7-.7 1.9-1.3.2-.7.2-1.2.1-1.4 0-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2z" />
  </svg>
);
const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

/* ── Executive Card ───────────────────────────────────────────── */
function ExecCard({ exec }: { exec: Executive }) {
  const [hovered, setHovered] = useState(false);
  const socials = [
    exec.facebook_url && { href: exec.facebook_url, icon: <FbIcon />, label: "Facebook" },
    exec.instagram_url && { href: exec.instagram_url, icon: <IgIcon />, label: "Instagram" },
    exec.linkedin_url && { href: exec.linkedin_url, icon: <LiIcon />, label: "LinkedIn" },
    exec.whatsapp && { href: `https://wa.me/${exec.whatsapp.replace(/\D/g, '')}`, icon: <WaIcon />, label: "WhatsApp" },
    exec.email && { href: `mailto:${exec.email}`, icon: <MailIcon />, label: "Email" },
  ].filter(Boolean) as { href: string; icon: React.ReactNode; label: string }[];

  return (
    <div
      className="relative group flex flex-col rounded-2xl overflow-hidden cursor-pointer"
      style={{
        background: "linear-gradient(145deg, #060f1e, #0a1a30)",
        border: `1px solid ${hovered ? "rgba(0,212,255,0.5)" : "rgba(0,212,255,0.12)"}`,
        transition: "all 0.35s cubic-bezier(.4,0,.2,1)",
        transform: hovered ? "translateY(-6px)" : "translateY(0)",
        boxShadow: hovered
          ? "0 20px 60px rgba(0,212,255,0.15), 0 0 0 1px rgba(0,212,255,0.3)"
          : "0 4px 20px rgba(0,0,0,0.3)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Photo */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "3/4" }}>
        {exec.photo_url ? (
          <img
            src={exec.photo_url}
            alt={exec.full_name}
            className="w-full h-full object-cover object-top transition-transform duration-500"
            style={{ transform: hovered ? "scale(1.06)" : "scale(1)" }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #0a1a30, #0f2a4a)" }}>
            <span className="text-6xl opacity-20">👤</span>
          </div>
        )}

        {/* Gradient overlay */}
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            background: "linear-gradient(0deg, rgba(2,8,16,0.95) 0%, rgba(2,8,16,0.4) 50%, transparent 100%)",
            opacity: hovered ? 1 : 0.7,
          }}
        />

        {/* Glowing border top */}
        <div
          className="absolute top-0 left-0 right-0 h-0.5 transition-opacity duration-300"
          style={{
            background: "linear-gradient(90deg, transparent, #00d4ff, transparent)",
            opacity: hovered ? 1 : 0,
          }}
        />

        {/* Social Links — appear on hover */}
        {socials.length > 0 && (
          <div
            className="absolute bottom-16 left-0 right-0 flex justify-center gap-2 transition-all duration-300"
            style={{
              opacity: hovered ? 1 : 0,
              transform: hovered ? "translateY(0)" : "translateY(8px)",
            }}>
            {socials.map((s, i) => (
              <a
                key={i}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110"
                style={{
                  background: "rgba(0,212,255,0.15)",
                  border: "1px solid rgba(0,212,255,0.4)",
                  color: "#00d4ff",
                  backdropFilter: "blur(8px)",
                }}
                title={s.label}>
                {s.icon}
              </a>
            ))}
          </div>
        )}

        {/* Name + Position overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3
            className="font-black text-sm leading-tight mb-1 transition-colors duration-300"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              color: hovered ? "#00d4ff" : "#e8f4ff",
              fontSize: "0.75rem",
            }}>
            {exec.full_name}
          </h3>
          <p className="text-xs font-semibold" style={{ color: "#00d4ff", opacity: 0.9 }}>
            {exec.position}
          </p>
          {exec.dept && (
            <p className="text-xs mt-0.5" style={{ color: "rgba(200,220,240,0.6)" }}>
              {exec.dept}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Moderator Card (larger, horizontal on desktop) ──────────── */
function ModeratorCard({ exec, featured }: { exec: Executive; featured?: boolean }) {
  const socials = [
    exec.facebook_url && { href: exec.facebook_url, icon: <FbIcon />, label: "Facebook" },
    exec.instagram_url && { href: exec.instagram_url, icon: <IgIcon />, label: "Instagram" },
    exec.linkedin_url && { href: exec.linkedin_url, icon: <LiIcon />, label: "LinkedIn" },
    exec.whatsapp && { href: `https://wa.me/${exec.whatsapp.replace(/\D/g, '')}`, icon: <WaIcon />, label: "WhatsApp" },
    exec.email && { href: `mailto:${exec.email}`, icon: <MailIcon />, label: "Email" },
  ].filter(Boolean) as { href: string; icon: React.ReactNode; label: string }[];

  return (
    <div
      className="group flex flex-col rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
      style={{
        background: "linear-gradient(145deg, #060f1e, #0a1a30)",
        border: featured ? "1px solid rgba(0,212,255,0.4)" : "1px solid rgba(0,212,255,0.12)",
        boxShadow: featured ? "0 0 40px rgba(0,212,255,0.1)" : "none",
      }}>
      <div className="relative overflow-hidden" style={{ aspectRatio: "3/4" }}>
        {exec.photo_url ? (
          <img src={exec.photo_url} alt={exec.full_name}
            className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #0a1a30, #0f2a4a)" }}>
            <span className="text-6xl opacity-20">👤</span>
          </div>
        )}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(0deg, rgba(2,8,16,0.92) 0%, rgba(2,8,16,0.3) 60%, transparent 100%)" }} />
        {featured && (
          <div className="absolute top-3 left-3 px-2 py-1 rounded text-xs font-black"
            style={{ background: "rgba(0,212,255,0.2)", color: "#00d4ff", border: "1px solid rgba(0,212,255,0.4)", fontFamily: "'Orbitron',sans-serif" }}>
            {exec.position}
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-black text-sm mb-1 group-hover:text-[var(--blue)] transition-colors"
            style={{ fontFamily: "'Orbitron', sans-serif", color: "#e8f4ff", fontSize: "0.8rem" }}>
            {exec.full_name}
          </h3>
          {!featured && (
            <p className="text-xs font-semibold mb-1" style={{ color: "#00d4ff" }}>{exec.position}</p>
          )}
          {exec.dept && <p className="text-xs" style={{ color: "rgba(200,220,240,0.6)" }}>{exec.dept}</p>}
          {socials.length > 0 && (
            <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              {socials.map((s, i) => (
                <a key={i} href={s.href} target="_blank" rel="noopener noreferrer"
                  className="w-7 h-7 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                  style={{ background: "rgba(0,212,255,0.15)", border: "1px solid rgba(0,212,255,0.3)", color: "#00d4ff" }}>
                  {s.icon}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══ Main Page ════════════════════════════════════════════════ */
export default function ExecutivesPage() {
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"committee" | "moderators">("committee");
  const [selectedYear, setSelectedYear] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/executives")
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d)) {
          const active = d.filter((e: Executive) => e.is_active);
          setExecutives(active);
          // Set default year to latest
          const years = [...new Set(active.map((e: Executive) => e.session_year))].sort((a, b) => b.localeCompare(a));
          if (years.length > 0) setSelectedYear(years[0]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const years = useMemo(() =>
    [...new Set(executives.map(e => e.session_year))].sort((a, b) => b.localeCompare(a)),
    [executives]
  );

  // Search across ALL years
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return executives.filter(e =>
      e.full_name.toLowerCase().includes(q) ||
      e.position.toLowerCase().includes(q) ||
      (e.dept && e.dept.toLowerCase().includes(q))
    );
  }, [search, executives]);

  const byYearAndPanel = useMemo(() =>
    executives.filter(e => e.session_year === selectedYear && e.panel === activeView)
      .sort((a, b) => a.display_order - b.display_order),
    [executives, selectedYear, activeView]
  );

  // For moderators panel — split into featured (chief patron, founder, current) and ex
  const featuredModerators = byYearAndPanel.filter(e =>
    ["chief patron", "founder", "moderator", "current moderator"].some(k =>
      e.position.toLowerCase().includes(k)
    )
  );
  const exModerators = byYearAndPanel.filter(e =>
    e.position.toLowerCase().includes("ex") ||
    e.position.toLowerCase().includes("former") ||
    e.position.toLowerCase().includes("past")
  );
  const otherModerators = byYearAndPanel.filter(e =>
    !featuredModerators.includes(e) && !exModerators.includes(e)
  );

  const panelTabs = [
    { id: "committee", label: "Executive Committee" },
    { id: "moderators", label: "Chief Patron & Moderators" },
  ];

  return (
    <div className="min-h-screen relative z-10" style={{ paddingTop: "72px", background: "var(--bg)" }}>

      {/* Hero */}
      <div className="py-16 text-center border-b relative overflow-hidden"
        style={{ background: "linear-gradient(180deg, var(--bg2), var(--bg))", borderColor: "var(--border)" }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ backgroundImage: "radial-gradient(ellipse at 50% 0%, rgba(0,212,255,0.06) 0%, transparent 70%)" }} />
        <div className="section-label justify-center mb-2">Our Team</div>
        <h1 className="text-4xl md:text-5xl font-black" style={{ fontFamily: "'Orbitron', sans-serif" }}>
          NDSC <span style={{ color: "var(--blue)" }}>EXECUTIVES</span>
        </h1>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">

        {/* Search Bar */}
        <div className="mb-8 max-w-md mx-auto">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search across all batches..."
              className="w-full rounded-xl px-4 py-3 pl-10 text-sm outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border)",
                color: "var(--white)",
              }}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base">🔍</span>
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
                style={{ color: "var(--muted)" }}>✕</button>
            )}
          </div>
        </div>

        {/* Search Results */}
        {search.trim() && (
          <div className="mb-10">
            <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for "{search}"
            </p>
            {searchResults.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {searchResults.map(e => (
                  <div key={e.id}>
                    <ExecCard exec={e} />
                    <p className="text-xs mt-1 text-center" style={{ color: "var(--muted)" }}>
                      {e.session_year}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-10" style={{ color: "var(--muted)" }}>No results found.</p>
            )}
          </div>
        )}

        {!search.trim() && (
          <>
            {/* Panel Tabs */}
            <div className="flex justify-center gap-3 mb-8">
              {panelTabs.map(t => (
                <button key={t.id} onClick={() => setActiveView(t.id as any)}
                  className="px-6 py-2.5 rounded-xl font-black text-sm tracking-wider border transition-all"
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    background: activeView === t.id ? "var(--blue)" : "transparent",
                    color: activeView === t.id ? "#000" : "var(--muted)",
                    borderColor: activeView === t.id ? "var(--blue)" : "var(--border)",
                  }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Year Selector */}
            <div className="flex justify-center flex-wrap gap-2 mb-10">
              {years.map(y => (
                <button key={y} onClick={() => setSelectedYear(y)}
                  className="px-4 py-1.5 rounded-lg text-xs font-black border transition-all"
                  style={{
                    fontFamily: "'Orbitron', sans-serif",
                    background: selectedYear === y ? "var(--blue)" : "transparent",
                    color: selectedYear === y ? "#000" : "var(--muted)",
                    borderColor: selectedYear === y ? "var(--blue)" : "var(--border)",
                  }}>
                  {y}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-20" style={{ color: "var(--muted)" }}>Loading...</div>
            ) : (
              <>
                {/* EXECUTIVE COMMITTEE */}
                {activeView === "committee" && (
                  <div>
                    {byYearAndPanel.length === 0 ? (
                      <div className="text-center py-20">
                        <p className="text-4xl mb-3">👥</p>
                        <p style={{ color: "var(--muted)" }}>No executives for this session.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
                        {byYearAndPanel.map(e => <ExecCard key={e.id} exec={e} />)}
                      </div>
                    )}
                  </div>
                )}

                {/* CHIEF PATRON & MODERATORS */}
                {activeView === "moderators" && (
                  <div>
                    {/* Featured top row — chief patron, founder, current moderator */}
                    {(featuredModerators.length > 0 || otherModerators.length > 0) && (
                      <div className="mb-12">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 max-w-3xl mx-auto">
                          {[...featuredModerators, ...otherModerators].map(e => (
                            <ModeratorCard key={e.id} exec={e} featured={
                              e.position.toLowerCase().includes("chief patron") ||
                              e.position.toLowerCase().includes("founder") ||
                              (e.position.toLowerCase().includes("moderator") && !e.position.toLowerCase().includes("ex"))
                            } />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Ex Moderators */}
                    {exModerators.length > 0 && (
                      <div>
                        <div className="text-center mb-8">
                          <h3 className="text-xl font-black"
                            style={{ fontFamily: "'Orbitron', sans-serif", color: "var(--muted)" }}>
                            EX <span style={{ color: "var(--blue)" }}>MODERATORS</span>
                          </h3>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5">
                          {exModerators.map(e => <ModeratorCard key={e.id} exec={e} />)}
                        </div>
                      </div>
                    )}

                    {byYearAndPanel.length === 0 && (
                      <div className="text-center py-20">
                        <p className="text-4xl mb-3">👥</p>
                        <p style={{ color: "var(--muted)" }}>No moderators for this session.</p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
