"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown, Search, Home, Info, Microscope, Newspaper, Users, Trophy, UserPlus } from "lucide-react";
import { ActivityIcon } from "@/lib/activityIcons";

type NavChild = { href: string; label: string; icon?: string };
type NavItem = { href?: string; label: string; children?: NavChild[] };

const STATIC_NAV: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About Us" },
  { label: "Activities", children: [] },
  { href: "/publication", label: "Publication" },
  {
    label: "Executives",
    children: [
      { href: "/executives?view=committee", label: "Executive Committee" },
      { href: "/executives?view=moderators", label: "Chief Patron & Moderators" },
    ],
  },
  { href: "/olympiad", label: "Olympiad" },
  { href: "/membership", label: "Membership" },
];

/* Map each top-level nav item to a lucide icon used in the mobile drawer. */
const NAV_ICON: Record<string, React.ReactNode> = {
  "/": <Home size={16} />,
  "/about": <Info size={16} />,
  "Activities": <Microscope size={16} />,
  "/publication": <Newspaper size={16} />,
  "Executives": <Users size={16} />,
  "/olympiad": <Trophy size={16} />,
  "/membership": <UserPlus size={16} />,
};

const HIDE_NAVBAR_ON = ["/login", "/register", "/dashboard", "/admin"];

function AuthButton({ mobile = false }: { mobile?: boolean }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    import("@/lib/supabase").then(({ supabase }) => {
      supabase.auth.getSession().then(({ data }) => {
        setLoggedIn(!!data.session);
        setReady(true);
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
        setLoggedIn(!!s);
        setReady(true);
      });
      unsub = () => subscription.unsubscribe();
    });
    return () => unsub?.();
  }, []);

  const handleLogout = async () => {
    const { supabase } = await import("@/lib/supabase");
    await supabase.auth.signOut();
    setLoggedIn(false);
    window.location.href = "/";
  };

  if (!ready) return <div className="px-4 py-2 text-xs rounded-lg border opacity-0" style={{ borderColor: "var(--blue)", width: 70, height: 34 }} />;

  if (mobile) {
    return loggedIn ? (
      <>
        <Link href="/dashboard" className="mt-5 py-4 text-center font-black tracking-widest rounded-xl border text-sm" style={{ borderColor: "var(--blue)", color: "var(--blue)", fontFamily: "'Orbitron',sans-serif" }}>MY DASHBOARD</Link>
        <button onClick={handleLogout} className="py-3 text-sm text-center" style={{ color: "var(--muted)" }}>Sign Out</button>
      </>
    ) : (
      <Link href="/login" className="mt-5 py-4 text-center font-black tracking-widest rounded-xl border text-sm" style={{ borderColor: "var(--blue)", color: "var(--blue)", fontFamily: "'Orbitron',sans-serif" }}>MEMBER LOGIN</Link>
    );
  }

  return loggedIn ? (
    <Link href="/dashboard" className="px-4 py-2 text-xs font-black tracking-widest rounded-lg border transition-all duration-200 hover:bg-[var(--blue)] hover:text-black hover:border-[var(--blue)]" style={{ borderColor: "var(--blue)", color: "var(--blue)", fontFamily: "'Orbitron',sans-serif" }}>Dashboard</Link>
  ) : (
    <Link href="/login" className="px-4 py-2 text-xs font-black tracking-widest rounded-lg border transition-all duration-200 hover:bg-[var(--blue)] hover:text-black hover:border-[var(--blue)]" style={{ borderColor: "var(--blue)", color: "var(--blue)", fontFamily: "'Orbitron',sans-serif" }}>Login</Link>
  );
}

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [actOpen, setActOpen] = useState(false);
  const [execOpen, setExecOpen] = useState(false);
  const [nav, setNav] = useState<NavItem[]>(STATIC_NAV);
  const [openDesktop, setOpenDesktop] = useState<string | null>(null);
  const pathname = usePathname();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/activity-types-public")
      .then((r) => r.json())
      .then((types: { name: string; slug: string; icon: string }[]) => {
        if (!Array.isArray(types) || types.length === 0) return;
        setNav((prev) =>
          prev.map((item) =>
            item.label === "Activities"
              ? { ...item, children: types.map((t) => ({ href: `/activities?tab=${t.slug}`, label: t.name, icon: t.icon })) }
              : item
          )
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setMobileOpen(false); setActOpen(false); setExecOpen(false); setOpenDesktop(null);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const hidden = HIDE_NAVBAR_ON.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (hidden) return null;

  const handleMouseEnter = (label: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenDesktop(label);
  };
  const handleMouseLeave = () => {
    closeTimer.current = setTimeout(() => setOpenDesktop(null), 150);
  };

  return (
    <>
      <style>{`
        .navbar-glass {
          background: rgba(2, 8, 16, 0.92);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border-bottom: 1px solid rgba(0, 212, 255, 0.12);
        }
        .nav-link {
          position: relative;
          font-size: 0.82rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--muted);
          transition: color 0.2s;
          font-family: 'Poppins', sans-serif;
          padding: 0.25rem 0;
        }
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 0;
          height: 1.5px;
          background: var(--blue);
          transition: width 0.25s cubic-bezier(0.22,1,0.36,1);
          border-radius: 2px;
        }
        .nav-link:hover { color: var(--blue); }
        .nav-link:hover::after { width: 100%; }
        .nav-link.active { color: var(--blue); }
        .nav-link.active::after { width: 100%; }

        /* Static, deliberate brand mark — replaces the old sliding-gradient
           "shimmer" (3s linear infinite background-position) which read as
           a 1999s web ring instead of a logo.

           The text now uses a fixed cyan→deep-cyan gradient with stops
           that read as one deliberate piece, not a moving bar. Hover
           swaps it to a crisp solid color and adds a small scale. */
        .ndsc-logo-text {
          background: linear-gradient(180deg, #e8f4ff 0%, #00d4ff 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          transition: filter 0.3s ease;
        }
        .ndsc-logo-glow {
          transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), filter 0.3s ease;
        }
        .ndsc-logo-glow:hover {
          transform: scale(1.04);
          filter:
            drop-shadow(0 0 10px rgba(0, 212, 255, 0.7))
            drop-shadow(0 0 22px rgba(0, 212, 255, 0.25));
        }
        .ndsc-logo-glow:hover .ndsc-logo-text {
          filter: brightness(1.15);
        }
      `}</style>

      <header className="navbar-glass fixed top-0 left-0 w-full z-50 transition-[background,backdrop-filter,border-color] duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between" style={{ height: "var(--navbar-height, 64px)" }}>

          {/* LOGO */}
          <Link href="/" className="ndsc-logo-glow flex items-center gap-3 shrink-0 z-10 group">
            <div className="relative" style={{ width: "var(--navbar-logo, 38px)", height: "var(--navbar-logo, 38px)" }}>
              <Image src="/images/cropped-logo.png" alt="NDSC" fill className="object-contain" />
            </div>
            <div className="hidden sm:flex flex-col leading-none">
              <span className="ndsc-logo-text text-sm font-black tracking-[0.2em]" style={{ fontFamily: "'Orbitron',sans-serif" }}>
                NDSC
              </span>
              <span className="text-[9px] tracking-[0.18em] mt-0.5 font-medium" style={{ color: "rgba(0,212,255,0.55)", fontFamily: "'Share Tech Mono',monospace" }}>
                Notre Dame Science Club
              </span>
            </div>
          </Link>

          {/* CENTER NAV — desktop */}
          <nav className="hidden lg:flex items-center gap-6 xl:gap-8 absolute left-1/2 -translate-x-1/2">
            {nav.map((item) =>
              item.children && item.children.length > 0 ? (
                <div key={item.label} className="relative"
                  onMouseEnter={() => handleMouseEnter(item.label)}
                  onMouseLeave={handleMouseLeave}>
                  <button className={`nav-link flex items-center gap-1 ${openDesktop === item.label ? "active" : ""}`}>
                    {item.label}
                    <ChevronDown size={12} style={{ transition: "transform .2s", transform: openDesktop === item.label ? "rotate(180deg)" : "" }} />
                  </button>
                  <div style={{
                    position: "absolute", top: "calc(100% + 10px)", left: "50%",
                    opacity: openDesktop === item.label ? 1 : 0,
                    pointerEvents: openDesktop === item.label ? "auto" : "none",
                    transition: "opacity .15s, transform .15s",
                    transform: openDesktop === item.label ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(-4px)",
                    zIndex: 50, minWidth: "210px",
                  }}>
                    <div className="rounded-xl border py-2" style={{
                      background: "rgba(3,10,22,0.98)", borderColor: "rgba(0,212,255,0.2)",
                      backdropFilter: "blur(24px)", boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.05)",
                    }}>
                      {item.children.map((c) => (
                        <Link key={c.href} href={c.href}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium transition-all hover:text-[var(--blue)] hover:pl-5 hover:bg-[rgba(0,212,255,0.04)]"
                          style={{ color: "var(--muted)" }}>
                          {c.icon ? (
                            <ActivityIcon icon={c.icon} size={14} className="shrink-0" style={{ color: "var(--blue)" }} />
                          ) : (
                            <span className="w-1 h-1 rounded-full shrink-0" style={{ background: "var(--blue)" }} />
                          )}
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ) : item.href ? (
                <Link key={item.href} href={item.href}
                  className={`nav-link ${pathname === item.href ? "active" : ""}`}>
                  {item.label}
                </Link>
              ) : null
            )}
          </nav>

          {/* RIGHT — auth button */}
          <div className="hidden lg:block">
            <AuthButton />
          </div>

          {/* Mobile hamburger */}
          <button className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg border z-10 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{ borderColor: "var(--border)", background: mobileOpen ? "var(--blue)" : "transparent" }}
            aria-label="Toggle menu">
            {mobileOpen ? <X size={20} color="#000" /> : <Menu size={20} style={{ color: "var(--blue)" }} />}
          </button>
        </div>
      </header>

      {/* MOBILE DRAWER (slides in from the left, like the reference) */}
      <style>{`
        .mnav-backdrop {
          position: fixed; inset: 0; z-index: 39; background: rgba(0, 0, 0, 0.55);
          backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px);
          opacity: 0; pointer-events: none;
          transition: opacity 0.3s ease;
        }
        .mnav-backdrop.open { opacity: 1; pointer-events: auto; }
        .mnav-drawer {
          position: fixed; top: 0; left: 0; bottom: 0; z-index: 40;
          width: min(86vw, 360px);
          display: flex; flex-direction: column;
          background: linear-gradient(180deg, rgba(8, 39, 122, 0.96) 0%, rgba(6, 26, 58, 0.97) 100%);
          backdrop-filter: blur(20px) saturate(150%);
          -webkit-backdrop-filter: blur(20px) saturate(150%);
          border-right: 1px solid rgba(0, 212, 255, 0.18);
          box-shadow: 18px 0 50px rgba(0, 0, 0, 0.5);
          transform: translateX(-100%);
          transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
          will-change: transform;
        }
        .mnav-drawer.open { transform: translateX(0); }
        .mnav-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 18px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.10);
          flex-shrink: 0;
        }
        .mnav-brand { display: flex; align-items: center; gap: 10px; }
        .mnav-brand .t1 {
          font-family: 'Orbitron', sans-serif;
          font-size: 14px; font-weight: 900; letter-spacing: 0.22em;
          background: linear-gradient(180deg, #e8f4ff 0%, #00d4ff 100%);
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .mnav-brand .t2 {
          font-family: 'Share Tech Mono', monospace;
          font-size: 9px; letter-spacing: 0.18em;
          color: rgba(0, 212, 255, 0.55); margin-top: 2px;
        }
        .mnav-close {
          width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #cbd5e1;
          transition: background 0.2s, color 0.2s, transform 0.2s;
          cursor: pointer;
        }
        .mnav-close:hover { background: rgba(0, 212, 255, 0.18); color: #00d4ff; transform: rotate(90deg); }
        .mnav-search {
          padding: 14px 18px 10px;
          flex-shrink: 0;
        }
        .mnav-search-box {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.10);
          color: #cbd5e1;
        }
        .mnav-search input {
          flex: 1; min-width: 0; background: transparent; border: 0; outline: 0;
          color: #fff; font-size: 13px; font-family: 'Poppins', sans-serif;
        }
        .mnav-search input::placeholder { color: rgba(203, 213, 225, 0.55); }
        .mnav-list {
          flex: 1; overflow-y: auto;
          padding: 8px 12px 16px;
          display: flex; flex-direction: column; gap: 4px;
        }
        .mnav-item {
          position: relative;
          display: flex; align-items: center; gap: 12px;
          padding: 12px 14px;
          border-radius: 12px;
          color: #e2e8f0;
          text-decoration: none;
          font-size: 14px; font-weight: 600;
          font-family: 'Poppins', sans-serif;
          background: transparent;
          border: 1px solid transparent;
          transition: background 0.2s, color 0.2s, border-color 0.2s, transform 0.2s;
          width: 100%; text-align: left;
          cursor: pointer;
        }
        .mnav-item:hover {
          background: rgba(0, 212, 255, 0.08);
          border-color: rgba(0, 212, 255, 0.18);
          color: #ffffff;
        }
        .mnav-item.active {
          background: rgba(0, 212, 255, 0.12);
          border-color: rgba(0, 212, 255, 0.32);
          color: #00d4ff;
        }
        .mnav-item .ico {
          width: 32px; height: 32px; min-width: 32px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 9px;
          background: rgba(0, 212, 255, 0.10);
          border: 1px solid rgba(0, 212, 255, 0.22);
          color: #00d4ff;
        }
        .mnav-item.active .ico {
          background: rgba(0, 212, 255, 0.22);
          border-color: rgba(0, 212, 255, 0.45);
        }
        .mnav-item .arrow { margin-left: auto; color: rgba(203, 213, 225, 0.6); transition: transform 0.2s; }
        .mnav-item.open .arrow { transform: rotate(180deg); color: #00d4ff; }
        .mnav-sub {
          display: flex; flex-direction: column; gap: 2px;
          padding: 4px 4px 8px 56px;
        }
        .mnav-sub a {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 10px;
          border-radius: 8px;
          color: #94a3b8;
          text-decoration: none;
          font-size: 13px; font-weight: 500;
          transition: color 0.2s, background 0.2s;
        }
        .mnav-sub a:hover { color: #00d4ff; background: rgba(0, 212, 255, 0.05); }
        .mnav-auth {
          padding: 12px 18px 22px;
          flex-shrink: 0;
          border-top: 1px solid rgba(255, 255, 255, 0.10);
        }
      `}</style>

      {/* Backdrop */}
      <div
        className={`mnav-backdrop lg:hidden ${mobileOpen ? "open" : ""}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className={`mnav-drawer lg:hidden ${mobileOpen ? "open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation"
      >
        <div className="mnav-header">
          <Link href="/" className="mnav-brand" onClick={() => setMobileOpen(false)}>
            <div style={{ width: 32, height: 32, position: "relative" }}>
              <Image src="/images/cropped-logo.png" alt="NDSC" fill className="object-contain" />
            </div>
            <div className="flex flex-col">
              <span className="t1">NDSC</span>
              <span className="t2">Notre Dame Science Club</span>
            </div>
          </Link>
          <button suppressHydrationWarning className="mnav-close" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <div className="mnav-search">
          <div className="mnav-search-box">
            <Search size={15} style={{ color: "rgba(0,212,255,0.7)" }} />
            <input suppressHydrationWarning type="text" placeholder="Search the site…" disabled />
          </div>
        </div>

        <nav className="mnav-list">
          {nav.map((item) => {
            if (item.children && item.children.length > 0) {
              const isOpen = (item.label === "Activities" && actOpen) || (item.label === "Executives" && execOpen);
              const icon = NAV_ICON[item.label] ?? <ChevronDown size={16} />;
              return (
                <div key={item.label}>
                  <button
                    suppressHydrationWarning
                    className={`mnav-item ${isOpen ? "open" : ""}`}
                    onClick={() => {
                      if (item.label === "Activities") setActOpen(!actOpen);
                      if (item.label === "Executives") setExecOpen(!execOpen);
                    }}
                  >
                    <span className="ico">{icon}</span>
                    <span>{item.label}</span>
                    <ChevronDown size={14} className="arrow" />
                  </button>
                  {isOpen && (
                    <div className="mnav-sub">
                      {item.children.map((c) => (
                        <Link key={c.href} href={c.href} onClick={() => setMobileOpen(false)}>
                          {c.icon ? (
                            <ActivityIcon icon={c.icon} size={14} className="shrink-0" style={{ color: "var(--blue)" }} />
                          ) : (
                            <span style={{ width: 6, height: 6, borderRadius: 3, background: "var(--blue)", display: "inline-block" }} />
                          )}
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            if (item.href) {
              const active = pathname === item.href;
              const icon = NAV_ICON[item.href] ?? <ChevronDown size={16} />;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`mnav-item ${active ? "active" : ""}`}
                >
                  <span className="ico">{icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            }
            return null;
          })}
        </nav>

        <div className="mnav-auth">
          <AuthButton mobile />
        </div>
      </aside>
    </>
  );
}
