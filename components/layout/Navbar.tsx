"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown } from "lucide-react";
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
          background: rgba(2, 8, 16, 0.97);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
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

        .ndsc-logo-text {
          background: linear-gradient(135deg, #00d4ff 0%, #0099cc 60%, #00d4ff 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmerText 3s linear infinite;
        }
        @keyframes shimmerText {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        .ndsc-logo-glow {
          filter: drop-shadow(0 0 8px rgba(0,212,255,0.5));
          transition: filter 0.3s;
        }
        .ndsc-logo-glow:hover {
          filter: drop-shadow(0 0 16px rgba(0,212,255,0.85));
        }
      `}</style>

      <header className="navbar-glass fixed top-0 left-0 w-full z-50 transition-all duration-300">
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

      {/* MOBILE MENU */}
      <div className="fixed inset-0 z-40 lg:hidden flex flex-col transition-all duration-300"
        style={{
          background: "rgba(2,8,16,0.99)", backdropFilter: "blur(20px)",
          opacity: mobileOpen ? 1 : 0, pointerEvents: mobileOpen ? "all" : "none",
          transform: mobileOpen ? "translateX(0)" : "translateX(100%)",
        }}>
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <Image src="/images/cropped-logo.png" alt="NDSC" width={32} height={32} />
            <div className="flex flex-col">
              <span className="text-sm font-black tracking-widest ndsc-logo-text" style={{ fontFamily: "'Orbitron',sans-serif" }}>NDSC</span>
              <span className="text-[9px] tracking-wider" style={{ color: "rgba(0,212,255,0.5)", fontFamily: "'Share Tech Mono',monospace" }}>Notre Dame Science Club</span>
            </div>
          </div>
          <button onClick={() => setMobileOpen(false)} className="p-1"><X size={22} style={{ color: "var(--muted)" }} /></button>
        </div>

        <nav className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-1">
          {nav.map((item) =>
            item.children && item.children.length > 0 ? (
              <div key={item.label}>
                <button
                  onClick={() => {
                    if (item.label === "Activities") setActOpen(!actOpen);
                    if (item.label === "Executives") setExecOpen(!execOpen);
                  }}
                  className="w-full flex items-center justify-between py-3 text-base font-bold border-b transition-colors"
                  style={{ borderColor: "var(--border)", color: "var(--white)", fontFamily: "'Orbitron',sans-serif" }}>
                  {item.label}
                  <ChevronDown size={16} style={{
                    color: "var(--muted)",
                    transform: (item.label === "Activities" && actOpen) || (item.label === "Executives" && execOpen) ? "rotate(180deg)" : "",
                    transition: "transform .2s",
                  }} />
                </button>
                {((item.label === "Activities" && actOpen) || (item.label === "Executives" && execOpen)) && (
                  <div className="pl-4 mt-1 mb-2 flex flex-col gap-1">
                    {item.children.map((c) => (
                      <Link key={c.href} href={c.href} className="flex items-center gap-2 py-2 text-sm transition-colors hover:text-[var(--blue)]" style={{ color: "var(--muted)" }}>
                        {c.icon ? (
                          <ActivityIcon icon={c.icon} size={14} className="shrink-0" style={{ color: "var(--blue)" }} />
                        ) : (
                          <span className="text-xs" style={{ color: "var(--blue)" }}>→</span>
                        )}
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : item.href ? (
              <Link key={item.href} href={item.href}
                className="py-3 text-base font-bold border-b transition-colors hover:text-[var(--blue)]"
                style={{ borderColor: "var(--border)", color: pathname === item.href ? "var(--blue)" : "var(--white)", fontFamily: "'Orbitron',sans-serif" }}>
                {item.label}
              </Link>
            ) : null
          )}
          <AuthButton mobile />
        </nav>
      </div>
    </>
  );
}
