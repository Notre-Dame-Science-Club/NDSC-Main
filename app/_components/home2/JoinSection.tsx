import Link from "next/link";

export default function JoinSection() {
  return (
    <section className="ch ch-fin" id="ch-join" data-cosmos-chapter>
      <div className="ch-eyebrow" data-rv="fade">Chapter 07 — Join Us</div>
      <p className="ch-body-lg" data-rv="up">
        Thousands of science enthusiasts, weekly workshops, olympiads and festivals — since 1955.
        Membership opens every session.
      </p>
      <Link className="ch-btn ch-btn-ghost" href="/auth/signup" data-rv="fade" data-cursor>
        <i />
        <span>Become a member</span>
        <svg viewBox="0 0 14 14" fill="none" width="13" height="13" style={{ position: "relative", zIndex: 1 }}>
          <path d="M3 11 11 3M5 3h6v6" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </Link>
      <span className="ch-fin-divider" aria-hidden="true" />
      <h2 className="ch-display" data-rv="up">Be part of the legacy</h2>
    </section>
  );
}
