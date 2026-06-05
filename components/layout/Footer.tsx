import Link from "next/link";
import Image from "next/image";
import { Mail, Phone, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer
      className="relative pt-16 pb-8"
      style={{
        background: "linear-gradient(180deg, var(--bg2), #000)",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">

          {/* Logo */}
          <div className="flex flex-col items-start gap-4">
            <div className="flex items-center gap-3">
              <Image src="/images/cropped-logo.png" alt="NDSC Logo" width={56} height={56} className="object-contain" />
              <div>
                <h3 className="text-sm font-bold tracking-widest" style={{ fontFamily: "'Orbitron', sans-serif", color: "var(--blue)" }}>Notre Dame</h3>
                <p className="text-xs tracking-wider" style={{ fontFamily: "'Orbitron', sans-serif", color: "var(--muted)" }}>Science Club</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
              Founded in 1955, the first college-level science club in the Indian Subcontinent. &quot;Science in Human Welfare.&quot;
            </p>
            <div className="flex gap-3 mt-2">
              <a href="https://www.facebook.com/NDSCOfficial" target="_blank" rel="noopener noreferrer"
                className="p-2 rounded border transition-colors hover:border-[var(--blue)] hover:text-[var(--blue)]"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
              <a href="https://www.instagram.com/ndsc_official/" target="_blank" rel="noopener noreferrer"
                className="p-2 rounded border transition-colors hover:border-[var(--blue)] hover:text-[var(--blue)]"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </a>
              <a href="https://www.linkedin.com/company/notre-dame-science-club/" target="_blank" rel="noopener noreferrer"
                className="p-2 rounded border transition-colors hover:border-[var(--blue)] hover:text-[var(--blue)]"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
              </a>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="text-xs font-bold tracking-widest mb-6 uppercase" style={{ fontFamily: "'Orbitron', sans-serif", color: "var(--blue)" }}>Navigation</h4>
            <div className="flex flex-col gap-3">
              {[
                { href: "/", label: "Home" },
                { href: "/about", label: "About Us" },
                { href: "/activities", label: "Activities" },
                { href: "/publication", label: "Publication" },
                { href: "/executives", label: "Executives" },
                { href: "/olympiad", label: "Olympiad" },
              ].map(({ href, label }) => (
                <Link key={href} href={href}
                  className="text-sm transition-colors hover:text-[var(--blue)]"
                  style={{ color: "var(--muted)" }}>
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Member Portal */}
          <div>
            <h4 className="text-xs font-bold tracking-widest mb-6 uppercase" style={{ fontFamily: "'Orbitron', sans-serif", color: "var(--blue)" }}>Member Portal</h4>
            <div className="flex flex-col gap-3">
              {[
                { href: "/login", label: "Member Login" },
                { href: "/register", label: "Register" },
                { href: "/dashboard", label: "Dashboard" },
              ].map(({ href, label }) => (
                <Link key={href} href={href}
                  className="text-sm transition-colors hover:text-[var(--blue)]"
                  style={{ color: "var(--muted)" }}>
                  {label}
                </Link>
              ))}
              <Link href="/admin/login"
                className="text-sm transition-colors hover:text-[var(--blue)]"
                style={{ color: "var(--muted)" }}>
                Admin Panel
              </Link>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-xs font-bold tracking-widest mb-6 uppercase" style={{ fontFamily: "'Orbitron', sans-serif", color: "var(--blue)" }}>Contact</h4>
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <MapPin size={16} className="mt-0.5 shrink-0" style={{ color: "var(--blue)" }} />
                <p className="text-sm" style={{ color: "var(--muted)" }}>G.P.O Box 5, Toyenbee Circular Rd,<br />Dhaka 1000</p>
              </div>
              <div className="flex items-center gap-3">
                <Mail size={16} style={{ color: "var(--blue)" }} />
                <a href="mailto:ndsc.org@gmail.com" className="text-sm hover:text-[var(--blue)] transition-colors" style={{ color: "var(--muted)" }}>ndsc.org@gmail.com</a>
              </div>
              <div className="flex items-center gap-3">
                <Phone size={16} style={{ color: "var(--blue)" }} />
                <a href="tel:+8801568171970" className="text-sm hover:text-[var(--blue)] transition-colors" style={{ color: "var(--muted)" }}>+880-1568-171970</a>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs"
          style={{ borderTop: "1px solid var(--border)", color: "var(--muted)" }}>
          <p>© {new Date().getFullYear()} Notre Dame Science Club (NDSC). All rights reserved.</p>
          <Link href="/developers" className="hover:text-[var(--blue)] transition-colors">🚀 Developers</Link>
        </div>
      </div>
    </footer>
  );
}
