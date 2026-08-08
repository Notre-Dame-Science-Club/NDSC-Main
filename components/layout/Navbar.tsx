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
        <Link href="/dashboard" className="mt-5 py-4 text-center font-black tracking-widest rounded-xl border text-sm" style={{ borderColor: "var(--blue)", color: "var(--blue)", fontFamily: 'inherit' }}>MY DASHBOARD</Link>
        <button onClick={handleLogout} className="py-3 text-sm text-center" style={{ color: "var(--muted)" }}>Sign Out</button>
      </>
    ) : (
      <Link href="/login" className="mt-5 py-4 text-center font-black tracking-widest rounded-xl border text-sm" style={{ borderColor: "var(--blue)", color: "var(--blue)", fontFamily: 'inherit' }}>MEMBER LOGIN</Link>
    );
  }

  return loggedIn ? (
    <Link href="/dashboard" className="px-4 py-2 text-xs font-black tracking-widest rounded-lg border transition-all duration-200 hover:bg-[var(--blue)] hover:text-black hover:border-[var(--blue)]" style={{ borderColor: "var(--blue)", color: "var(--blue)", fontFamily: 'inherit' }}>Dashboard</Link>
  ) : (
    <Link href="/login" className="px-4 py-2 text-xs font-black tracking-widest rounded-lg border transition-all duration-200 hover:bg-[var(--blue)] hover:text-black hover:border-[var(--blue)]" style={{ borderColor: "var(--blue)", color: "var(--blue)", fontFamily: 'inherit' }}>Login</Link>
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
  const desktopWheelRef = useRef<HTMLSpanElement | null>(null);
  const mobileWheelRef = useRef<HTMLSpanElement | null>(null);

  // Drive the wheel from JS. The same animator that moves the wheel
  // also writes the text visibility directly to the DOM, so motion
  // and text stay in perfect sync without React re-renders.
  useEffect(() => {
    let raf = 0;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // ── Timing of one cycle, in seconds ──────────────────────────────
    const CYCLE = 15;
    const ROLL_DURATION = 2.4;
    const PARK_DURATION = 1.0;
    const IDLE_FRACTION = 0.30;
    // idle = 4.5s, roll-out = 2.4s, park = 1.0s, roll-back = 2.4s, trailing idle = 4.7s

    // Cubic ease-in-out — smooth acceleration, slight settle.
    const easeInOut = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // Wait one frame so refs are populated after mount.
    const start = performance.now();
    let lastMoving: boolean | null = null;

    const setMovingAttr = (el: HTMLElement | null, v: boolean) => {
      if (!el) return;
      if (el.dataset.moving !== String(v)) el.dataset.moving = String(v);
    };
    const setTransform = (el: HTMLElement | null, tx: number, rot: number) => {
      if (!el) return;
      el.style.transform = `translateX(${tx}px) rotate(${rot}deg)`;
    };

    const tick = (now: number) => {
      const t = ((now - start) / 1000) % CYCLE;
      const phase = t / CYCLE;

      let rot = 0;
      const rollFrac = ROLL_DURATION / CYCLE;
      const parkFrac = PARK_DURATION / CYCLE;
      const rollStart = IDLE_FRACTION;
      const parkStart = rollStart + rollFrac;
      const rollBackStart = parkStart + parkFrac;
      const cycleEnd = rollBackStart + rollFrac;

      if (phase >= rollStart && phase < parkStart) {
        const k = (phase - rollStart) / rollFrac;
        const e = easeInOut(k);
        // Pure in-place rotation — no horizontal translate, so the icon
        // never leaves its flex slot on mobile. The outer span has
        // `overflow: hidden` so any minor pixel-rounding stays inside
        // the icon's footprint.
        rot = 360 * e;
      } else if (phase >= parkStart && phase < rollBackStart) {
        rot = 360;
      } else if (phase >= rollBackStart && phase < cycleEnd) {
        const k = (phase - rollBackStart) / rollFrac;
        const e = easeInOut(k);
        rot = 360 * (1 - e);
      }

      const moving = rot !== 0;
      setTransform(desktopWheelRef.current?.firstElementChild as HTMLElement | null, 0, rot);
      setTransform(mobileWheelRef.current?.firstElementChild as HTMLElement | null, 0, rot);
      if (moving !== lastMoving) {
        lastMoving = moving;
        const dt = desktopWheelRef.current?.parentElement?.querySelector<HTMLElement>(".ndsc-logo-text-wrap");
        const mt = mobileWheelRef.current?.parentElement?.querySelector<HTMLElement>(".t1-wrap");
        setMovingAttr(dt, moving);
        setMovingAttr(mt, moving);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

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
          border-bottom: 1px solid rgba(var(--blue-rgb), 0.12);
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
          background: linear-gradient(180deg, #e8f4ff 0%, var(--blue) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          transition: filter 0.3s ease;
        }

        /* Logo motion is JS-driven (see useEffect in component). */
        .ndsc-logo-mark {
          display: inline-block;
          transform-origin: 50% 50%;
          will-change: transform;
          overflow: hidden;
          border-radius: 6px;
        }
        /* Inner element the JS animator translates/rotates. We animate the
           INNER, not the .ndsc-logo-mark itself — translating the outer
           span would push the icon away from the brand text and create a
           200+px gap on the top bar. */
        .ndsc-logo-mark-inner {
          display: block;
          width: 100%;
          height: 100%;
          position: relative;
          will-change: transform;
        }
        .ndsc-logo-text-wrap {
          overflow: hidden;
          max-width: 220px;
        }
        .ndsc-logo-text-inner {
          display: block;
          opacity: 1;
          transition: opacity 0.35s ease;
        }
        .ndsc-logo-text-wrap[data-moving="true"] .ndsc-logo-text-inner {
          opacity: 0;
        }
        .ndsc-logo-glow {
          transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), filter 0.3s ease;
        }
        .ndsc-logo-glow:hover {
          transform: scale(1.03);
          filter:
            drop-shadow(0 0 10px rgba(var(--blue-rgb), 0.7))
            drop-shadow(0 0 22px rgba(var(--blue-rgb), 0.25));
        }
        .ndsc-logo-glow:hover .ndsc-logo-text {
          filter: brightness(1.15);
        }
      `}</style>

      <header className="navbar-glass fixed top-0 left-0 w-full z-50 transition-[background,backdrop-filter,border-color] duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between" style={{ height: "var(--navbar-height, 64px)" }}>

          {/* LOGO */}
          <Link href="/" className="ndsc-logo-glow flex items-center gap-2.5 sm:gap-3 shrink-0 z-10 group">
            <span ref={desktopWheelRef} className="ndsc-logo-mark relative shrink-0" style={{ width: "var(--navbar-logo, 38px)", height: "var(--navbar-logo, 38px)", display: "inline-block" }}>
              <span className="ndsc-logo-mark-inner">
                <Image src="/images/cropped-logo.png" alt="NDSC" fill className="object-contain" />
              </span>
            </span>
            <div className="ndsc-logo-text-wrap flex flex-col leading-none min-w-0">
              <span className="ndsc-logo-text-inner">
                <span className="ndsc-logo-text text-[12px] sm:text-sm font-black tracking-[0.2em] block truncate" style={{ fontFamily: 'inherit' }}>
                  NDSC
                </span>
                <span className="hidden sm:block text-[9px] tracking-[0.18em] mt-0.5 font-medium truncate" style={{ color: "rgba(var(--blue-rgb), 0.55)", fontFamily: "var(--font-mono)" }}>
                  Notre Dame Science Club
                </span>
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
                      background: "rgba(3,10,22,0.98)", borderColor: "rgba(var(--blue-rgb), 0.2)",
                      backdropFilter: "blur(24px)", boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(var(--blue-rgb), 0.05)",
                    }}>
                      {item.children.map((c) => (
                        <Link key={c.href} href={c.href}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium transition-all hover:text-[var(--blue)] hover:pl-5 hover:bg-[rgba(var(--blue-rgb), 0.04)]"
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

      {/* MOBILE DRAWER — same dark-glass language as the header (no navy
         gradient, no heavy "apps" tile icons). The drawer should feel like
         a vertical extension of the navbar, not a separate material. */}
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
          background: rgba(2, 8, 16, 0.94);
          backdrop-filter: blur(20px) saturate(150%);
          -webkit-backdrop-filter: blur(20px) saturate(150%);
          border-right: 1px solid rgba(var(--blue-rgb), 0.14);
          box-shadow: 18px 0 50px rgba(0, 0, 0, 0.5);
          transform: translateX(-100%);
          transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
          will-change: transform;
        }
        .mnav-drawer.open { transform: translateX(0); }
        .mnav-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 18px;
          border-bottom: 1px solid rgba(var(--blue-rgb), 0.10);
          flex-shrink: 0;
          min-height: var(--navbar-height, 64px);
        }
        .mnav-brand {
          display: flex; align-items: center; gap: 12px;
          text-decoration: none; color: inherit; min-width: 0;
        }
        .mnav-brand .t1 {
          font-family: var(--font-heading);
          font-size: 14px; font-weight: 900; letter-spacing: 0.22em;
          background: linear-gradient(180deg, #e8f4ff 0%, var(--blue) 100%);
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .mnav-brand .t1-wrap {
          display: block; overflow: hidden; vertical-align: middle;
          max-width: 200px;
        }
        .mnav-brand .t1-inner {
          display: block;
          opacity: 1;
          transition: opacity 0.35s ease;
        }
        .mnav-brand .t1-wrap[data-moving="true"] .t1-inner {
          opacity: 0;
        }
        .mnav-brand .mark {
          display: inline-block;
          transform-origin: 50% 50%;
          will-change: transform;
          flex-shrink: 0;
        }
        .mnav-brand .t2 {
          font-family: var(--font-mono);
          font-size: 9px; letter-spacing: 0.18em;
          color: rgba(var(--blue-rgb), 0.55); margin-top: 2px;
        }
        .mnav-close {
          width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 10px;
          background: transparent;
          border: 1px solid var(--border);
          color: var(--muted);
          transition: background 0.2s, color 0.2s, border-color 0.2s;
          cursor: pointer;
          flex-shrink: 0;
        }
        .mnav-close:hover {
          background: rgba(var(--blue-rgb), 0.10);
          color: var(--blue);
          border-color: rgba(var(--blue-rgb), 0.35);
        }
        .mnav-list {
          flex: 1; overflow-y: auto;
          padding: 12px 14px 20px;
          display: flex; flex-direction: column; gap: 2px;
        }
        .mnav-section-label {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: rgba(var(--blue-rgb), 0.45);
          padding: 14px 12px 8px;
          display: flex; align-items: center; gap: 8px;
        }
        .mnav-section-label::before {
          content: '';
          display: inline-block;
          width: 18px; height: 1px;
          background: rgba(var(--blue-rgb), 0.45);
        }
        .mnav-item {
          position: relative;
          display: flex; align-items: center; gap: 10px;
          padding: 11px 12px;
          border-radius: 8px;
          color: var(--white);
          text-decoration: none;
          font-size: 13px; font-weight: 600;
          letter-spacing: 0.04em;
          font-family: 'Poppins', sans-serif;
          background: transparent;
          border: 1px solid transparent;
          transition: background 0.18s, color 0.18s, border-color 0.18s;
          width: 100%; text-align: left;
          cursor: pointer;
        }
        .mnav-item:hover {
          background: rgba(var(--blue-rgb), 0.06);
          color: var(--blue);
        }
        .mnav-item.active {
          background: rgba(var(--blue-rgb), 0.08);
          border-color: rgba(var(--blue-rgb), 0.20);
          color: var(--blue);
        }
        /* Underline accent on the active item — matches the desktop nav
           link's animated underline treatment, so the mobile drawer and
           desktop nav feel like one coherent system. */
        .mnav-item.active::before {
          content: '';
          position: absolute;
          left: 0; top: 50%;
          transform: translateY(-50%);
          width: 2px; height: 18px;
          background: var(--blue);
          border-radius: 2px;
        }
        .mnav-item .arrow {
          margin-left: auto;
          color: rgba(var(--blue-rgb), 0.4);
          transition: transform 0.2s, color 0.2s;
        }
        .mnav-item.open .arrow {
          transform: rotate(180deg);
          color: var(--blue);
        }
        .mnav-sub {
          display: flex; flex-direction: column; gap: 1px;
          padding: 4px 0 6px 12px;
          margin-left: 8px;
          border-left: 1px solid rgba(var(--blue-rgb), 0.12);
        }
        .mnav-sub a {
          display: flex; align-items: center; gap: 8px;
          padding: 9px 12px;
          border-radius: 6px;
          color: var(--muted);
          text-decoration: none;
          font-size: 12.5px; font-weight: 500;
          letter-spacing: 0.02em;
          transition: color 0.18s, background 0.18s;
        }
        .mnav-sub a:hover { color: var(--blue); background: rgba(var(--blue-rgb), 0.05); }
        .mnav-sub a.active-sub { color: var(--blue); }
        .mnav-auth {
          padding: 14px 18px max(env(safe-area-inset-bottom), 18px);
          flex-shrink: 0;
          border-top: 1px solid rgba(var(--blue-rgb), 0.10);
          display: flex; flex-direction: column; gap: 6px;
        }
        .mnav-foot {
          padding: 10px 18px 14px;
          font-family: var(--font-mono);
          font-size: 9px;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: rgba(var(--blue-rgb), 0.35);
          text-align: center;
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
            <span ref={mobileWheelRef} className="mark" style={{ width: 36, height: 36, position: "relative", display: "inline-block", overflow: "hidden", borderRadius: 6 }}>
              <span style={{ display: "block", width: "100%", height: "100%", position: "relative" }}>
                <Image src="/images/cropped-logo.png" alt="NDSC" fill className="object-contain" />
              </span>
            </span>
            <div className="flex flex-col leading-none min-w-0">
              <span className="t1-wrap">
                <span className="t1-inner">
                  <span className="t1 block">NDSC</span>
                  <span className="t2 block">Notre Dame Science Club</span>
                </span>
              </span>
            </div>
          </Link>
          <button suppressHydrationWarning className="mnav-close" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="mnav-list">
          <div className="mnav-section-label">Navigate</div>
          {nav.map((item) => {
            if (item.children && item.children.length > 0) {
              const isOpen = (item.label === "Activities" && actOpen) || (item.label === "Executives" && execOpen);
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
                    <span>{item.label}</span>
                    <ChevronDown size={14} className="arrow" />
                  </button>
                  {isOpen && (
                    <div className="mnav-sub">
                      {item.children.map((c) => {
                        const subActive = pathname === c.href;
                        return (
                          <Link
                            key={c.href}
                            href={c.href}
                            onClick={() => setMobileOpen(false)}
                            className={subActive ? "active-sub" : ""}
                          >
                            {c.icon ? (
                              <ActivityIcon icon={c.icon} size={13} className="shrink-0" style={{ color: "var(--blue)" }} />
                            ) : (
                              <span style={{ width: 5, height: 5, borderRadius: 3, background: "var(--blue)", display: "inline-block", flexShrink: 0 }} />
                            )}
                            {c.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }
            if (item.href) {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`mnav-item ${active ? "active" : ""}`}
                >
                  <span>{item.label}</span>
                </Link>
              );
            }
            return null;
          })}
        </nav>

        <div className="mnav-auth">
          <AuthButton mobile />
          <div className="mnav-foot">NDSC · Est. 1955</div>
        </div>
      </aside>
    </>
  );
}
