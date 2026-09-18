import Link from "next/link";
import Image from "next/image";
import { Mail, Phone, MapPin, ExternalLink, Code2, Facebook, Instagram, Youtube, Linkedin, Navigation, UserPlus, LogIn, LayoutDashboard, ShieldCheck, BookOpen, Users, Microscope, Trophy, Newspaper } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Home", icon: <Navigation size={13} /> },
  { href: "/about", label: "About Us", icon: <BookOpen size={13} /> },
  { href: "/activities", label: "Activities", icon: <Microscope size={13} /> },
  { href: "/publication", label: "Publication", icon: <Newspaper size={13} /> },
  { href: "/executives", label: "Executives", icon: <Users size={13} /> },
  { href: "/olympiad", label: "Olympiad", icon: <Trophy size={13} /> },
];

const PORTAL_LINKS = [
  { href: "/membership", label: "Membership", icon: <UserPlus size={13} /> },
  { href: "/login", label: "Member Login", icon: <LogIn size={13} /> },
  { href: "/register", label: "Register", icon: <UserPlus size={13} /> },
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard size={13} /> },
  { href: "/admin/login", label: "Admin Panel", icon: <ShieldCheck size={13} /> },
];

const CONTACT_LINKS = [
  { href: "tel:+8801568171970", label: "+880-1568-171970", icon: <Phone size={13} />, external: false },
  { href: "mailto:contact@ndscbd.net", label: "contact@ndscbd.net", icon: <Mail size={13} />, external: false },
  { href: "https://maps.google.com/?q=Notre+Dame+College+Dhaka", label: "G.P.O Box 5, Toyenbee Circular Rd, Dhaka 1000", icon: <MapPin size={13} />, external: true },
  { href: "https://maps.google.com/?q=Notre+Dame+College+Dhaka", label: "Open in Google Maps", icon: <ExternalLink size={13} />, external: true },
];

const SOCIALS = [
  { href: "https://www.facebook.com/ndscbd.official/", label: "Facebook", icon: <Facebook size={13} /> },
  { href: "https://www.instagram.com/ndscbd.official/", label: "Instagram", icon: <Instagram size={13} /> },
  { href: "https://www.youtube.com/@ndscbd.official/", label: "YouTube", icon: <Youtube size={13} /> },
  { href: "https://www.linkedin.com/company/notre-dame-science-club/", label: "LinkedIn", icon: <Linkedin size={13} /> },
];

/* One plain footer link row -- no card, no box, just an icon + label that
   slides right and picks up the accent color on hover. Same treatment for
   nav links, contact details and socials, so the whole footer reads as one
   consistent list system instead of four different widget styles. */
function FootLink({
  href,
  label,
  icon,
  external = false,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  external?: boolean;
}) {
  const Comp: any = external ? "a" : Link;
  const extra = external ? { target: "_blank", rel: "noopener noreferrer" } : {};
  return (
    <li>
      <Comp href={href} {...extra} className="foot-link">
        <span className="foot-link-ic">{icon}</span>
        <span className="foot-link-tx">{label}</span>
      </Comp>
    </li>
  );
}

export default function Footer() {
  return (
    <footer className="footer-shell" id="ch-footer" data-cosmos-chapter>
      <style>{`
        .footer-shell {
          position: relative;
          width: 100%;
          color: var(--white);
          font-family: var(--font-body);
          overflow: hidden;
          padding: clamp(54px, 8vh, 100px) var(--pad, clamp(20px,3.4vw,60px)) clamp(26px, 4vh, 42px);
        }
        .footer-shell::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background: linear-gradient(180deg, rgba(2,5,12,.35) 0%, rgba(2,5,12,.9) 38%, rgba(2,5,12,.98) 100%);
        }
        .footer-shell::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background:
            radial-gradient(ellipse at 0% 0%, rgba(var(--blue-rgb), 0.07), transparent 55%),
            radial-gradient(ellipse at 100% 100%, rgba(var(--blue-rgb), 0.05), transparent 60%);
        }
        .footer-top-glow {
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(var(--blue-rgb), 0.4), transparent);
        }
        .foot-inner {
          position: relative;
          max-width: 1280px;
          margin: 0 auto;
        }

        /* -- brand strip -- */
        .foot-brand {
          display: grid;
          grid-template-columns: 60px minmax(0, 1fr);
          align-items: center;
          gap: 22px;
          padding-bottom: clamp(28px, 4.4vh, 44px);
          margin-bottom: clamp(28px, 4.4vh, 48px);
          border-bottom: 1px solid var(--border-soft);
        }
        .foot-brand-logo {
          width: 60px;
          height: 60px;
          position: relative;
          filter: drop-shadow(0 0 14px rgba(var(--blue-rgb), 0.35));
        }
        .foot-brand-copy {
          font-family: var(--font-heading);
          font-weight: 400;
          font-size: clamp(16px, 1.9vw, 25px);
          line-height: 1.38;
          color: var(--white-soft);
          margin: 0;
          max-width: 62ch;
        }
        .foot-brand-copy b {
          font-weight: 600;
          color: var(--white);
        }
        .foot-brand-copy em {
          font-style: normal;
          color: var(--blue);
        }

        /* -- link grid -- */
        .foot-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: clamp(22px, 3.6vw, 48px);
        }
        .foot-col h4 {
          margin: 0 0 18px;
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .foot-col ul {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
        }
        .foot-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 0;
          color: var(--white-soft) !important;
          text-decoration: none !important;
          font-size: 13.5px;
          line-height: 1.4;
          transition: color 0.28s ease, transform 0.28s ease;
        }
        .foot-link-ic {
          display: inline-flex;
          color: rgba(var(--blue-rgb), 0.7);
          flex-shrink: 0;
          transition: color 0.28s ease;
        }
        .foot-link-tx {
          overflow-wrap: anywhere;
        }
        .foot-link:hover {
          color: var(--blue) !important;
          transform: translateX(5px);
        }
        .foot-link:hover .foot-link-ic {
          color: var(--blue);
        }

        /* -- bottom bar -- */
        .foot-base {
          position: relative;
          margin-top: clamp(32px, 5vh, 56px);
          padding-top: 22px;
          border-top: 1px solid var(--border-soft);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px 28px;
          font-family: var(--font-mono);
          font-size: 10.5px;
          font-weight: 500;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .foot-base a {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: rgba(var(--blue-rgb), 0.75) !important;
          text-decoration: none !important;
          transition: color 0.25s ease;
        }
        .foot-base a:hover { color: var(--blue) !important; }

        @media screen and (max-width: 1000px) {
          .foot-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 34px 24px; }
        }
        @media screen and (max-width: 620px) {
          .foot-brand { grid-template-columns: 46px minmax(0, 1fr); gap: 16px; }
          .foot-brand-logo { width: 46px; height: 46px; }
          .foot-base { flex-direction: column; align-items: flex-start; gap: 8px; }
        }
      `}</style>

      <div className="footer-top-glow" />

      <div className="foot-inner">
        {/* Brand strip */}
        <div className="foot-brand">
          <div className="foot-brand-logo">
            <Image src="/images/cropped-logo.png" alt="NDSC" fill className="object-contain" />
          </div>
          <p className="foot-brand-copy">
            The pioneer science club of the <b>Indian Subcontinent</b>, founded <em>1955</em> at
            Notre Dame College, Dhaka.
          </p>
        </div>

        {/* Link columns */}
        <div className="foot-grid">
          <div className="foot-col">
            <h4>Club</h4>
            <ul>
              {NAV_LINKS.map(({ href, label, icon }) => (
                <FootLink key={href} href={href} label={label} icon={icon} />
              ))}
            </ul>
          </div>

          <div className="foot-col">
            <h4>Member Portal</h4>
            <ul>
              {PORTAL_LINKS.map(({ href, label, icon }) => (
                <FootLink key={href} href={href} label={label} icon={icon} />
              ))}
            </ul>
          </div>

          <div className="foot-col">
            <h4>Contact</h4>
            <ul>
              {CONTACT_LINKS.map(({ href, label, icon, external }) => (
                <FootLink key={label} href={href} label={label} icon={icon} external={external} />
              ))}
            </ul>
          </div>

          <div className="foot-col">
            <h4>Elsewhere</h4>
            <ul>
              {SOCIALS.map(({ href, label, icon }) => (
                <FootLink key={href} href={href} label={label} icon={icon} external />
              ))}
              <FootLink href="/developers" label="Developers" icon={<Code2 size={13} />} />
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="foot-base">
          <span>© {new Date().getFullYear()} Notre Dame Science Club</span>
          <span>Science in Human Welfare</span>
          <span>Est. 1955 · Dhaka, BD</span>
        </div>
      </div>
    </footer>
  );
}
