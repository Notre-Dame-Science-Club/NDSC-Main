"use client";
import Link from "next/link";
import Image from "next/image";
import { Sparkles, FileCheck, Wallet, IdCard, Clock, MessageCircle, Trophy, Bell, Users } from "lucide-react";

const DEPTS = [
  { name: "Administration", icon: "/images/admininstration-icon.svg", color: "var(--blue)" },
  { name: "Project", icon: "/images/project-icon.svg", color: "var(--cat-teal)" },
  { name: "Publication", icon: "/images/publication-icon.svg", color: "var(--accent2)" },
  { name: "ICT", icon: "/images/ict-icon.svg", color: "var(--cat-red)" },
  { name: "LWS", icon: "/images/lws-icon.svg", color: "var(--cat-amber)" },
  { name: "Quiz", icon: "/images/quiz-icon.svg", color: "var(--info)" },
  { name: "R&D", icon: "/images/r&d-icon.svg", color: "var(--cat-orange)" },
];

const BENEFITS = [
  { icon: Trophy, title: "Member-only Olympiads", desc: "Get early access and exclusive entries to NDSC olympiads and competitions reserved for members." },
  { icon: Users, title: "Join a Department", desc: "Get placed in one of our 7 departments and work directly on real events, publications, or projects." },
  { icon: MessageCircle, title: "Members' Messenger Group", desc: "Be part of the active member-only Messenger group — announcements, discussions, and behind-the-scenes club life." },
  { icon: Bell, title: "Never Miss an Update", desc: "A personal dashboard with live updates on events, olympiads, and new activities, all in one place." },
  { icon: IdCard, title: "Official ID Card", desc: "Get your own NDSC member ID card, your proof of being part of Bangladesh's oldest science club." },
  { icon: Sparkles, title: "Showcase Achievements", desc: "Add your certificates and accomplishments to your profile and have them featured in the club's record." },
];

const STEPS = [
  { icon: Wallet, title: "Collect the form", desc: "Visit the control room and collect a club membership form for a 20 taka form fee." },
  { icon: FileCheck, title: "Fill & submit", desc: "Fill out the form and submit it back at the control room along with the 200 taka membership fee." },
  { icon: IdCard, title: "Get your slip", desc: "You'll receive a slip as proof of submission — keep it safe, you'll need a photo of it to sign up here." },
  { icon: Clock, title: "ID card later", desc: "ID cards are printed and distributed after the membership deadline closes — there's naturally a short wait, so don't worry if yours isn't ready immediately." },
];

export default function MembershipPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="fixed inset-0 grid-bg opacity-20 pointer-events-none" />

      {/* HERO */}
      <section className="relative pt-32 pb-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="section-label mb-3 inline-block">Membership</div>
          <h1 className="text-3xl sm:text-5xl font-black mb-5" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            BECOME AN <span style={{ color: "var(--blue)" }}>NDSC MEMBER</span>
          </h1>
          <p className="text-sm sm:text-base max-w-2xl mx-auto" style={{ color: "var(--muted)" }}>
            Join Bangladesh's oldest college science club. Get a department, a community, and a
            portal built just for members — full of updates, olympiads, and recognition for what
            you do.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <Link href="/register"
              className="px-7 py-3 rounded-xl font-bold text-sm text-black transition-all hover:-translate-y-0.5"
              style={{ background: "var(--blue)", fontFamily: "'Orbitron', sans-serif" }}>
              Sign Up as Member
            </Link>
            <Link href="/login"
              className="px-7 py-3 rounded-xl font-bold text-sm border transition-all hover:-translate-y-0.5"
              style={{ borderColor: "var(--blue)", color: "var(--blue)", fontFamily: "'Orbitron', sans-serif" }}>
              Login as Member
            </Link>
          </div>
        </div>
      </section>

      {/* WHY BECOME A MEMBER */}
      <section className="relative py-14 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="section-label mb-2">Why Join</div>
          <h2 className="text-2xl sm:text-3xl font-black mb-10" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            WHY BECOME A <span style={{ color: "var(--blue)" }}>MEMBER?</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {BENEFITS.map(b => (
              <div key={b.title}
                className="rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1"
                style={{ background: "var(--bg2)", borderColor: "var(--border)" }}>
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl mb-4"
                  style={{ background: "rgba(var(--blue-rgb), 0.1)", border: "1px solid rgba(var(--blue-rgb), 0.25)" }}>
                  <b.icon size={20} style={{ color: "var(--blue)" }} />
                </div>
                <h3 className="text-sm font-bold mb-1.5" style={{ color: "var(--white)" }}>{b.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW TO BECOME A MEMBER */}
      <section className="relative py-14 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="section-label mb-2">Process</div>
          <h2 className="text-2xl sm:text-3xl font-black mb-3" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            HOW TO BECOME A <span style={{ color: "var(--blue)" }}>MEMBER</span>
          </h2>
          <p className="text-sm mb-10 max-w-xl" style={{ color: "var(--muted)" }}>
            Membership starts offline at the college control room — here's exactly what to do.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative rounded-2xl p-5 border" style={{ background: "var(--bg2)", borderColor: "var(--border)" }}>
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black"
                  style={{ background: "var(--blue)", color: "#000", fontFamily: "'Orbitron', sans-serif" }}>
                  {i + 1}
                </div>
                <s.icon size={20} style={{ color: "var(--blue)" }} className="mb-3" />
                <h3 className="text-sm font-bold mb-1.5" style={{ color: "var(--white)" }}>{s.title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 rounded-xl border text-sm flex items-start gap-3"
            style={{ background: "rgba(var(--warning-rgb), 0.06)", borderColor: "rgba(var(--warning-rgb), 0.25)" }}>
            <Clock size={16} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 2 }} />
            <p style={{ color: "var(--muted)" }}>
              There's a first deadline for membership intake. After it closes, joining is still
              possible by speaking directly with the Executive Committee. Verification for
              everyone — members and olympiad participants alike — is primarily done using your{" "}
              <strong style={{ color: "var(--white)" }}>8-digit college roll number</strong>, with
              your email as a secondary check.
            </p>
          </div>
        </div>
      </section>

      {/* DEPARTMENTS */}
      <section className="relative py-14 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="section-label mb-2">Structure</div>
          <h2 className="text-2xl sm:text-3xl font-black mb-3" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            7 <span style={{ color: "var(--blue)" }}>DEPARTMENTS</span> TO JOIN
          </h2>
          <p className="text-sm mb-10 max-w-xl" style={{ color: "var(--muted)" }}>
            Once approved, the club places you in one of these departments based on your interests.
          </p>
          <div className="flex flex-wrap gap-4">
            {DEPTS.map(d => (
              <div key={d.name}
                className="flex items-center gap-3 px-5 py-3 rounded-xl border transition-all hover:-translate-y-0.5"
                style={{ background: "var(--bg2)", borderColor: "var(--border)" }}>
                <div className="relative w-8 h-8">
                  <Image src={d.icon} alt={d.name} fill className="object-contain" style={{ filter: `drop-shadow(0 0 8px ${d.color})` }} />
                </div>
                <span className="text-sm font-semibold" style={{ color: "var(--white)" }}>{d.name}</span>
              </div>
            ))}
          </div>
          <p className="text-xs mt-6" style={{ color: "var(--muted)" }}>
            Want details on what each department does?{" "}
            <Link href="/about#departments" className="underline" style={{ color: "var(--blue)" }}>
              See the full breakdown on our About page.
            </Link>
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative py-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center rounded-3xl p-10 border"
          style={{ background: "linear-gradient(135deg, rgba(var(--blue-rgb), 0.06), rgba(var(--blue-rgb), 0.01))", borderColor: "rgba(var(--blue-rgb), 0.25)" }}>
          <h2 className="text-xl sm:text-2xl font-black mb-3" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            Already got your slip? <span style={{ color: "var(--blue)" }}>Sign up now.</span>
          </h2>
          <p className="text-sm mb-7" style={{ color: "var(--muted)" }}>
            It only takes a couple of minutes — your account will be reviewed and approved shortly after.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/register"
              className="px-7 py-3 rounded-xl font-bold text-sm text-black transition-all hover:-translate-y-0.5"
              style={{ background: "var(--blue)", fontFamily: "'Orbitron', sans-serif" }}>
              Sign Up as Member
            </Link>
            <Link href="/login"
              className="px-7 py-3 rounded-xl font-bold text-sm border transition-all hover:-translate-y-0.5"
              style={{ borderColor: "var(--blue)", color: "var(--blue)", fontFamily: "'Orbitron', sans-serif" }}>
              Login as Member
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
