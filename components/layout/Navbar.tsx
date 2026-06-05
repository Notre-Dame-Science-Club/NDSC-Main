"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown } from "lucide-react";

type NavChild = { href: string; label: string };
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

  if (!ready) {
    return (
      <div className="px-4 py-2 text-xs rounded-lg border opacity-0"
        style={{ borderColor: "var(--blue)", width: 70, height: 34 }} />
    );
  }

  if (mobile) {
    return loggedIn ? (
      <>
        <Link href="/dashboard"
          className="mt-5 py-4 text-center font-black tracking-widest rounded-xl border text-sm"
          style={{ borderColor: "var(--blue)", color: "var(--blue)", fontFamily: "'Orbitron',sans-serif" }}>
          MY DASHBOARD
        </Link>
        <button onClick={handleLogout} className="py-3 text-sm text-center"
          style={{ color: "var(--muted)" }}>
          Sign Out
        </button>
      </>
    ) : (
      <Link href="/login"
        className="mt-5 py-4 text-center font-black tracking-widest rounded-xl border text-sm"
        style={{ borderColor: "var(--blue)", color: "var(--blue)", fontFamily: "'Orbitron',sans-serif" }}>
        MEMBER LOGIN
      </Link>
    );
  }

  return loggedIn ? (
    <Link href="/dashboard"
      className="px-4 py-2 text-xs font-black tracking-widest rounded-lg border transition-all duration-200 hover:bg-[var(--blue)] hover:text-black hover:border-[var(--blue)]"
      style={{ borderColor: "var(--blue)", color: "var(--blue)", fontFamily: "'Orbitron',sans-serif" }}>
      Dashboard
    </Link>
  ) : (
    <Link href="/login"
      className="px-4 py-2 text-xs font-black tracking-widest rounded-lg border transition-all duration-200 hover:bg-[var(--blue)] hover:text-black hover:border-[var(--blue)]"
      style={{ borderColor: "var(--blue)", color: "var(--blue)", fontFamily: "'Orbitron',sans-serif" }}>
      Login
    </Link>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
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
              ? { ...item, children: types.map((t) => ({ href: `/activities?tab=${t.slug}`, label: `${t.icon || ""} ${t.name}`.trim() })) }
              : item
          )
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
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
      <header className="fixed top-0 left-0 w-full z-50 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(2,8,16,0.96)" : "transparent",
          backdropFilter: scrolled ? "blur(14px)" : "none",
          borderBottom: scrolled ? "1px solid var(--border)" : "none",
        }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 shrink-0 z-10">
            <Image src="/images/cropped-logo.png" alt="NDSC" width={36} height={36} className="object-contain" />
            <div className="hidden sm:block leading-none">
              <p className="text-xs font-black tracking-widest"
                style={{ fontFamily: "'Orbitron',sans-serif", color: "var(--blue)" }}>NDSC</p>
              <p className="text-[9px] tracking-wide mt-0.5" style={{ color: "var(--muted)" }}>Notre Dame Science Club</p>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-5 xl:gap-7">
            {nav.map((item) =>
              item.children && item.children.length > 0 ? (
                <div key={item.label} className="relative"
                  onMouseEnter={() => handleMouseEnter(item.label)}
                  onMouseLeave={handleMouseLeave}>
                  <button className="flex items-center gap-1 text-sm font-medium transition-colors"
                    style={{ color: openDesktop === item.label ? "var(--blue)" : "var(--muted)" }}>
                    {item.label}
                    <ChevronDown size={13} style={{ transition: "transform .2s", transform: openDesktop === item.label ? "rotate(180deg)" : "" }} />
                  </button>
                  <div style={{
                    position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
                    paddingTop: "10px", opacity: openDesktop === item.label ? 1 : 0,
                    pointerEvents: openDesktop === item.label ? "auto" : "none",
                    transition: "opacity .15s", zIndex: 50, minWidth: "200px",
                  }}>
                    <div className="rounded-xl border py-2" style={{
                      background: "rgba(5,13,26,0.98)", borderColor: "var(--border)",
                      backdropFilter: "blur(20px)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                    }}>
                      {item.children.map((c) => (
                        <Link key={c.href} href={c.href}
                          className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium transition-all hover:text-[var(--blue)] hover:pl-5"
                          style={{ color: "var(--muted)" }}>
                          <span className="w-1 h-1 rounded-full shrink-0" style={{ background: "var(--blue)" }} />
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ) : item.href ? (
                <Link key={item.href ?? item.label} href={item.href}
                  className="relative text-sm font-medium transition-colors group"
                  style={{ color: pathname === item.href ? "var(--blue)" : "var(--muted)" }}>
                  {item.label}
                  <span className="absolute -bottom-0.5 left-0 h-px transition-all duration-300 w-0 group-hover:w-full"
                    style={{ background: "var(--blue)" }} />
                </Link>
              ) : null
            )}
            <AuthButton />
          </nav>

          <button className="lg:hidden flex items-center justify-center w-10 h-10 rounded-lg border z-10 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{ borderColor: "var(--border)", background: mobileOpen ? "var(--blue)" : "transparent" }}
            aria-label="Toggle menu">
            {mobileOpen ? <X size={20} color="#000" /> : <Menu size={20} style={{ color: "var(--blue)" }} />}
          </button>
        </div>
      </header>

      <div className="fixed inset-0 z-40 lg:hidden flex flex-col transition-all duration-300"
        style={{
          background: "rgba(2,8,16,0.99)", backdropFilter: "blur(20px)",
          opacity: mobileOpen ? 1 : 0, pointerEvents: mobileOpen ? "all" : "none",
          transform: mobileOpen ? "translateX(0)" : "translateX(100%)",
        }}>
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0"
          style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <Image src="/images/cropped-logo.png" alt="NDSC" width={32} height={32} />
            <span className="text-sm font-black tracking-widest"
              style={{ fontFamily: "'Orbitron',sans-serif", color: "var(--blue)" }}>NDSC</span>
          </div>
          <button onClick={() => setMobileOpen(false)} className="p-1">
            <X size={22} style={{ color: "var(--muted)" }} />
          </button>
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
                      <Link key={c.href} href={c.href}
                        className="py-2 text-sm transition-colors hover:text-[var(--blue)]"
                        style={{ color: "var(--muted)" }}>
                        → {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
                        ) : item.href ? (
              <Link
                key={item.href ?? item.label}
                href={item.href}
                className="py-3 text-base font-bold border-b transition-colors hover:text-[var(--blue)]"
                style={{
                  borderColor: "var(--border)",
                  color: pathname === item.href ? "var(--blue)" : "var(--white)",
                  fontFamily: "'Orbitron',sans-serif",
                }}
              >
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
