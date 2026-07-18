import Link from "next/link";
import Image from "next/image";
import { Mail, Phone, MapPin, ExternalLink, Code2, Facebook, Instagram, Youtube, Linkedin, Navigation, UserPlus, LogIn, LayoutDashboard, ShieldCheck, BookOpen, Users, Microscope, Trophy, Newspaper } from "lucide-react";

/* Small helper — icon-tile row used inside the frosted-glass cards.
   Keeps the contact + social cards consistent. */
function ContactRow({
  href,
  label,
  value,
  icon,
  external = false,
}: {
  href: string;
  label: string;
  value: string;
  icon: React.ReactNode;
  external?: boolean;
}) {
  const Comp: any = external ? "a" : Link;
  const extra = external ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <Comp href={href} {...extra} className="footer-row group">
      <span className="footer-row-icon">{icon}</span>
      <span className="footer-row-text">
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
    </Comp>
  );
}

const SOCIALS = [
  {
    href: "https://www.facebook.com/ndscbd.official/",
    label: "Like on",
    value: "Facebook",
    icon: <Facebook size={18} />,
  },
  {
    href: "https://www.instagram.com/ndscbd.official/",
    label: "Follow on",
    value: "Instagram",
    icon: <Instagram size={18} />,
  },
  {
    href: "https://www.youtube.com/@ndscbd.official/",
    label: "Subscribe on",
    value: "YouTube",
    icon: <Youtube size={18} />,
  },
  {
    href: "https://www.linkedin.com/company/notre-dame-science-club/",
    label: "Connect on",
    value: "LinkedIn",
    icon: <Linkedin size={18} />,
  },
];

const NAV_LINKS = [
  { href: "/", label: "Home", icon: <Navigation size={14} /> },
  { href: "/about", label: "About Us", icon: <BookOpen size={14} /> },
  { href: "/activities", label: "Activities", icon: <Microscope size={14} /> },
  { href: "/publication", label: "Publication", icon: <Newspaper size={14} /> },
  { href: "/executives", label: "Executives", icon: <Users size={14} /> },
  { href: "/olympiad", label: "Olympiad", icon: <Trophy size={14} /> },
];

const PORTAL_LINKS = [
  { href: "/membership", label: "Membership", icon: <UserPlus size={14} /> },
  { href: "/login", label: "Member Login", icon: <LogIn size={14} /> },
  { href: "/register", label: "Register", icon: <UserPlus size={14} /> },
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={14} /> },
  { href: "/admin/login", label: "Admin Panel", icon: <ShieldCheck size={14} /> },
];

export default function Footer() {
  return (
    <footer
      className="footer-shell"
      style={{
        background: "linear-gradient(135deg, #08277A 0%, #061A3A 100%)",
      }}
    >
      <style>{`
        .footer-shell {
          position: relative;
          width: 100%;
          color: #fff;
          font-family: 'Poppins', 'Plus Jakarta Sans', sans-serif;
          overflow: hidden;
        }
        .footer-shell::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse at 0% 0%, rgba(0, 212, 255, 0.10), transparent 55%),
            radial-gradient(ellipse at 100% 100%, rgba(0, 212, 255, 0.07), transparent 60%);
          pointer-events: none;
        }
        .footer-top-glow {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.45), transparent);
        }
        .footer-inner {
          position: relative;
          width: calc(100% - 40px);
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(260px, 320px) minmax(0, 1fr) minmax(260px, 320px);
          gap: clamp(25px, 3vw, 45px);
          align-items: start;
        }
        .footer-glass {
          width: 100%;
          min-width: 0;
          padding: 24px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.08);
          box-shadow: 0 20px 45px rgba(0, 0, 0, 0.22);
          backdrop-filter: blur(14px) saturate(140%);
          -webkit-backdrop-filter: blur(14px) saturate(140%);
        }
        .footer-row-list {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 12px;
          width: 100%;
          margin: 0;
        }
        .footer-row {
          display: flex !important;
          align-items: center;
          width: 100%;
          min-width: 0;
          gap: 12px;
          margin: 0 !important;
          padding: 13px 14px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff !important;
          text-decoration: none !important;
          transition: background-color 0.3s ease, border-color 0.3s ease, transform 0.3s ease;
        }
        .footer-row:hover {
          color: #ffffff !important;
          background: rgba(255, 255, 255, 0.14);
          border-color: rgba(255, 255, 255, 0.24);
          transform: translateY(-2px);
        }
        .footer-row-icon {
          width: 38px;
          height: 38px;
          min-width: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(0, 212, 255, 0.32);
          border-radius: 12px;
          background: rgba(0, 212, 255, 0.14);
          color: #00d4ff;
        }
        .footer-row-text {
          min-width: 0;
          flex: 1;
        }
        .footer-row-text small {
          display: block;
          margin: 0 0 3px;
          color: #aebfdb;
          font-size: 12px;
          font-weight: 400;
          line-height: 1.3;
        }
        .footer-row-text strong {
          display: block;
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.35;
          overflow-wrap: anywhere;
          word-break: break-word;
        }
        .footer-links-wrap {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 35px;
          align-items: start;
          padding-top: 5px;
        }
        .footer-link-group h3 {
          margin: 0 0 17px;
          color: #ffffff !important;
          font-family: 'Orbitron', sans-serif;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          line-height: 1.3;
        }
        .footer-link-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .footer-link-list a {
          display: flex;
          align-items: center;
          gap: 8px;
          width: fit-content;
          max-width: 100%;
          padding: 6px 0;
          color: #cbd5e1 !important;
          font-size: 14px;
          font-weight: 400;
          line-height: 1.4;
          text-decoration: none !important;
          transition: color 0.3s ease, transform 0.3s ease;
        }
        .footer-link-list a:hover {
          color: #00d4ff !important;
          transform: translateX(5px);
        }
        .footer-link-list a .li-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #00d4ff;
          opacity: 0.6;
          transition: opacity 0.3s, transform 0.3s;
        }
        .footer-link-list a:hover .li-dot {
          opacity: 1;
          transform: scale(1.4);
        }
        .footer-bottom {
          position: relative;
          width: calc(100% - 40px);
          max-width: 1200px;
          margin: 38px auto 0;
          padding: 20px 0 4px;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
        }
        .footer-bottom p {
          margin: 0 !important;
          color: #cbd5e1 !important;
          font-size: 14px;
          font-weight: 400;
          line-height: 1.5;
        }
        .footer-bottom-meta {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .footer-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
        }
        .footer-brand-logo {
          width: 44px;
          height: 44px;
          position: relative;
          filter: drop-shadow(0 0 10px rgba(0, 212, 255, 0.4));
        }
        .footer-brand-text {
          display: flex;
          flex-direction: column;
          line-height: 1.1;
        }
        .footer-brand-text .t1 {
          font-family: 'Orbitron', sans-serif;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 0.22em;
          background: linear-gradient(180deg, #e8f4ff 0%, #00d4ff 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .footer-brand-text .t2 {
          font-family: 'Share Tech Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.18em;
          color: rgba(0, 212, 255, 0.6);
          margin-top: 2px;
        }
        .footer-blurb {
          color: #cbd5e1;
          font-size: 13px;
          line-height: 1.55;
          margin: 0;
        }
        .footer-blurb em {
          color: rgba(0, 212, 255, 0.85);
          font-style: normal;
        }

        @media screen and (max-width: 1050px) {
          .footer-inner {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 30px;
          }
          .footer-contact-card { order: 1; }
          .footer-social-card { order: 2; }
          .footer-links-wrap {
            grid-column: 1 / -1;
            order: 3;
            gap: 30px;
            padding-top: 5px;
          }
        }
        @media screen and (max-width: 700px) {
          .footer-shell { padding: 45px 0 20px; }
          .footer-inner {
            width: calc(100% - 32px);
            grid-template-columns: minmax(0, 1fr);
            gap: 24px;
          }
          .footer-links-wrap {
            grid-column: auto;
            order: 3;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 20px;
          }
          .footer-glass { padding: 20px; }
          .footer-link-group h3 { font-size: 14px; }
          .footer-bottom {
            width: calc(100% - 32px);
            margin-top: 30px;
            padding-top: 18px;
            flex-direction: column;
            justify-content: center;
            text-align: center;
            gap: 8px;
          }
        }
        @media screen and (max-width: 420px) {
          .footer-links-wrap {
            grid-template-columns: minmax(0, 1fr);
            gap: 25px;
          }
          .footer-glass { padding: 16px; }
          .footer-row { padding: 12px; }
          .footer-row-text strong { font-size: 13px; }
        }
      `}</style>

      {/* Top glow line */}
      <div className="footer-top-glow" />

      <div style={{ padding: "60px 0 20px" }}>
        <div className="footer-inner">
          {/* Contact Card */}
          <div className="footer-glass footer-contact-card">
            <div className="footer-brand">
              <div className="footer-brand-logo">
                <Image src="/images/cropped-logo.png" alt="NDSC" fill className="object-contain" />
              </div>
              <div className="footer-brand-text">
                <span className="t1">NDSC</span>
                <span className="t2">Notre Dame Science Club</span>
              </div>
            </div>
            <p className="footer-blurb" style={{ marginBottom: 16 }}>
              Founded in <em style={{ color: "rgba(0,212,255,0.95)" }}>1955</em> — the first
              college-level science club in the Indian Subcontinent. Upholding
              <em> &quot;Science in Human Welfare.&quot;</em>
            </p>

            <div className="footer-row-list">
              <ContactRow
                href="tel:+8801568171970"
                label="Contact"
                value="+880-1568-171970"
                icon={<Phone size={16} />}
              />
              <ContactRow
                href="mailto:contact@ndscbd.net"
                label="Email"
                value="contact@ndscbd.net"
                icon={<Mail size={16} />}
              />
              <ContactRow
                href="https://maps.google.com/?q=Notre+Dame+College+Dhaka"
                label="Address"
                value="G.P.O Box 5, Toyenbee Circular Rd, Dhaka 1000"
                icon={<MapPin size={16} />}
                external
              />
              <ContactRow
                href="https://maps.google.com/?q=Notre+Dame+College+Dhaka"
                label="Find Us"
                value="Open in Google Maps"
                icon={<ExternalLink size={16} />}
                external
              />
            </div>
          </div>

          {/* Link Columns */}
          <div className="footer-links-wrap">
            <div className="footer-link-group">
              <h3>Navigate</h3>
              <div className="footer-link-list">
                {NAV_LINKS.map(({ href, label, icon }) => (
                  <Link key={href} href={href}>
                    <span className="li-dot" />
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: "var(--blue)", display: "inline-flex" }}>{icon}</span>
                      {label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="footer-link-group">
              <h3>Member Portal</h3>
              <div className="footer-link-list">
                {PORTAL_LINKS.map(({ href, label, icon }) => (
                  <Link key={href} href={href}>
                    <span className="li-dot" />
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: "var(--blue)", display: "inline-flex" }}>{icon}</span>
                      {label}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Social Card */}
          <div className="footer-glass footer-social-card">
            <h3
              style={{
                margin: "0 0 16px",
                color: "#fff",
                fontFamily: "'Orbitron', sans-serif",
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              Follow Us
            </h3>
            <div className="footer-row-list">
              {SOCIALS.map(({ href, label, value, icon }) => (
                <ContactRow
                  key={href}
                  href={href}
                  label={label}
                  value={value}
                  icon={icon}
                  external
                />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="footer-bottom">
          <p>
            © {new Date().getFullYear()} Notre Dame Science Club (NDSC). All rights reserved.
          </p>
          <div className="footer-bottom-meta">
            <span
              style={{
                fontFamily: "'Share Tech Mono', monospace",
                fontSize: 12,
                letterSpacing: "0.18em",
                color: "rgba(0,212,255,0.5)",
              }}
            >
              EST. 1955 · DHAKA, BD
            </span>
            <Link
              href="/developers"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "rgba(0,212,255,0.7)",
                fontFamily: "'Share Tech Mono', monospace",
                textDecoration: "none",
              }}
            >
              <Code2 size={12} /> DEVELOPERS
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
