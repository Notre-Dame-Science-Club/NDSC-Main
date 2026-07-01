import Link from "next/link";
import Image from "next/image";
import { Mail, Phone, MapPin, ExternalLink } from "lucide-react";

export default function Footer() {
  return (
    <footer
      className="relative"
      style={{
        background: "linear-gradient(180deg, var(--bg2) 0%, #000308 100%)",
        borderTop: "1px solid rgba(0,212,255,0.12)",
      }}
    >
      {/* Top glow line */}
      <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.4), transparent)" }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-14 pb-8">

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-14 text-center sm:text-left">

          {/* Logo + about */}
          <div className="flex flex-col items-center sm:items-start gap-5">
            <Link href="/" className="flex flex-col items-center sm:items-start gap-3 group">
              <div className="relative w-14 h-14" style={{ filter: "drop-shadow(0 0 12px rgba(0,212,255,0.5))", transition: "filter 0.3s" }}>
                <Image src="/images/cropped-logo.png" alt="NDSC Logo" fill className="object-contain" />
              </div>
              <div className="text-center sm:text-left">
                <p className="text-sm font-black tracking-[0.22em]" style={{ fontFamily: "'Orbitron', sans-serif", color: "var(--blue)" }}>NDSC</p>
                <p className="text-[10px] tracking-[0.18em] mt-0.5" style={{ fontFamily: "'Share Tech Mono', monospace", color: "rgba(0,212,255,0.5)" }}>Notre Dame Science Club</p>
              </div>
            </Link>
            <p className="text-xs leading-relaxed text-center sm:text-left" style={{ color: "var(--muted)", maxWidth: 220 }}>
              Founded in <span style={{ color: "var(--blue)" }}>1955</span> — the first college-level science club in the Indian Subcontinent. Upholding <em style={{ color: "rgba(0,212,255,0.7)" }}>"Science in Human Welfare."</em>
            </p>

            {/* Social icons */}
            <div className="flex gap-2.5 justify-center sm:justify-start flex-wrap">
              {[
                {
                  href: "https://www.facebook.com/ndscbd.official/",
                  label: "Facebook",
                  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                },
                {
                  href: "https://www.instagram.com/ndscbd.official/",
                  label: "Instagram",
                  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                },
                {
                  href: "https://www.youtube.com/@ndscbd.official/",
                  label: "YouTube",
                  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.97C18.88 4 12 4 12 4s-6.88 0-8.59.45A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.41 19.6C5.12 20 12 20 12 20s6.88 0 8.59-.45a2.78 2.78 0 0 0 1.95-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>
                },
                {
                  href: "https://www.linkedin.com/company/notre-dame-science-club/",
                  label: "LinkedIn",
                  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                },
              ].map(({ href, label, icon }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                  aria-label={label}
                  className="p-2.5 rounded-lg border transition-all duration-200 hover:border-[var(--blue)] hover:text-[var(--blue)] hover:bg-[rgba(0,212,255,0.06)] hover:-translate-y-0.5"
                  style={{ borderColor: "rgba(0,212,255,0.15)", color: "var(--muted)" }}>
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex flex-col items-center sm:items-start">
            <h4 className="text-[10px] font-black tracking-[0.3em] mb-5 uppercase flex items-center gap-2" style={{ fontFamily: "'Orbitron', sans-serif", color: "var(--blue)" }}>
              <span style={{ display: "inline-block", width: 16, height: 1, background: "var(--blue)" }} />
              Navigation
            </h4>
            <div className="flex flex-col gap-2.5 items-center sm:items-start">
              {[
                { href: "/", label: "Home" },
                { href: "/about", label: "About Us" },
                { href: "/activities", label: "Activities" },
                { href: "/publication", label: "Publication" },
                { href: "/executives", label: "Executives" },
                { href: "/olympiad", label: "Olympiad" },
              ].map(({ href, label }) => (
                <Link key={href} href={href}
                  className="text-xs font-medium transition-all duration-200 hover:text-[var(--blue)] hover:translate-x-1 flex items-center gap-1.5 group"
                  style={{ color: "var(--muted)" }}>
                  <span className="w-1 h-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "var(--blue)", flexShrink: 0 }} />
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Member Portal */}
          <div className="flex flex-col items-center sm:items-start">
            <h4 className="text-[10px] font-black tracking-[0.3em] mb-5 uppercase flex items-center gap-2" style={{ fontFamily: "'Orbitron', sans-serif", color: "var(--blue)" }}>
              <span style={{ display: "inline-block", width: 16, height: 1, background: "var(--blue)" }} />
              Member Portal
            </h4>
            <div className="flex flex-col gap-2.5 items-center sm:items-start">
              {[
                { href: "/membership", label: "Membership" },
                { href: "/login", label: "Member Login" },
                { href: "/register", label: "Register" },
                { href: "/dashboard", label: "Dashboard" },
                { href: "/admin/login", label: "Admin Panel" },
              ].map(({ href, label }) => (
                <Link key={href} href={href}
                  className="text-xs font-medium transition-all duration-200 hover:text-[var(--blue)] hover:translate-x-1 flex items-center gap-1.5 group"
                  style={{ color: "var(--muted)" }}>
                  <span className="w-1 h-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "var(--blue)", flexShrink: 0 }} />
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {/* Contact + Map */}
          <div className="flex flex-col items-center sm:items-start">
            <h4 className="text-[10px] font-black tracking-[0.3em] mb-5 uppercase flex items-center gap-2" style={{ fontFamily: "'Orbitron', sans-serif", color: "var(--blue)" }}>
              <span style={{ display: "inline-block", width: 16, height: 1, background: "var(--blue)" }} />
              Contact
            </h4>
            
              <a href="mailto:contact@ndscbd.net" className="flex items-center gap-3 text-xs hover:text-[var(--blue)] transition-colors group">
                <Mail size={14} style={{ color: "var(--blue)", flexShrink: 0 }} />
                <span style={{ color: "var(--muted)" }} className="group-hover:text-[var(--blue)] transition-colors">contact@ndscbd.net</span>
              </a>
              <a href="tel:+8801568171970" className="flex items-center gap-3 text-xs hover:text-[var(--blue)] transition-colors group">
                <Phone size={14} style={{ color: "var(--blue)", flexShrink: 0 }} />
                <span style={{ color: "var(--muted)" }} className="group-hover:text-[var(--blue)] transition-colors">+880-1568-171970</span>
              </a>

              <div className="flex flex-col gap-4 items-center sm:items-start w-full">
              <div className="flex items-start gap-3 text-center sm:text-left">
                <MapPin size={14} className="mt-0.5 shrink-0" style={{ color: "var(--blue)" }} />
                <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                  G.P.O Box 5, Toyenbee Circular Rd,<br />Dhaka 1000, Bangladesh
                </p>
              </div>

              {/* Google Maps embed */}
              <div className="w-full mt-2 rounded-xl overflow-hidden border" style={{ borderColor: "rgba(0,212,255,0.18)", boxShadow: "0 0 20px rgba(0,212,255,0.06)" }}>
                <div style={{ position: "relative", paddingBottom: "62%", width: "100%", height: "40%" }}>
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3651.9068527395384!2d90.40580957530252!3d23.726488778685456!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3755b89b08d29ac3%3A0x6a29c6fde93a9498!2sNotre%20Dame%20College!5e0!3m2!1sen!2sbd!4v1716000000000!5m2!1sen!2sbd"
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Notre Dame College — NDSC Location"
                  />
                </div>
                <a
                  href="https://maps.google.com/?q=Notre+Dame+College+Dhaka"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold tracking-widest transition-colors hover:text-[var(--blue)]"
                  style={{ color: "rgba(0,212,255,0.6)", fontFamily: "'Share Tech Mono',monospace", background: "rgba(0,212,255,0.04)" }}>
                  <ExternalLink size={10} /> OPEN IN GOOGLE MAPS
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.2), transparent)", marginBottom: "1.5rem" }} />

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center">
          <p className="text-xs" style={{ color: "rgba(0,212,255,0.35)", fontFamily: "'Share Tech Mono',monospace", letterSpacing: "0.1em" }}>
            © {new Date().getFullYear()} Notre Dame Science Club (NDSC). All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <span className="text-xs" style={{ color: "rgba(0,212,255,0.25)", fontFamily: "'Share Tech Mono',monospace" }}>
              EST. 1955 · DHAKA, BD
            </span>
            <Link href="/developers"
              className="text-xs font-bold tracking-widest hover:text-[var(--blue)] transition-colors flex items-center gap-1"
              style={{ color: "rgba(0,212,255,0.45)", fontFamily: "'Share Tech Mono',monospace" }}>
              🚀 Developers
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
