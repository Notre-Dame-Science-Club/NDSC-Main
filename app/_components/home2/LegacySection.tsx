import Link from "next/link";

/**
 * Chapter 1. The club's own pitch, with the link into Departments — "see
 * how we are built" reads as a lead-in to what follows, not an
 * afterthought tacked onto the end of the founder's biography the way it
 * used to. The vintage photo strip (LegacyGallerySection) and the founder
 * profile (FounderSection) are their own components, rendered right after
 * this one in app/page.tsx.
 */
export default function LegacySection() {
  return (
    <section className="ch" id="ch-legacy" data-cosmos-chapter>
      <div className="ch-head" data-rv="fade">
        <span className="k"><b>01</b> — Who We Are</span>
        <span className="ch-rule" />
        <span className="k">EST. 1955</span>
      </div>

      <div className="ch-story-grid">
        <h2 className="ch-display ch-sec" data-rv="up" style={{ maxWidth: "13ch" }}>
          Indian Subcontinent&apos;s pioneer science club.
        </h2>
        <div className="ch-story-copy">
          <p className="ch-body-lg" data-rv="up">
            Notre Dame Science Club, also known as <strong>NDSC</strong>, is the most promising,
            versatile and eminent co-curricular club of Notre Dame College, Dhaka. It began its
            inception in <strong className="c">1955</strong> with a singular mission — to ignite a
            passion for science among students. It holds the proud distinction of being the pioneer
            science club of the Indian Subcontinent.
          </p>
          <Link className="ch-arrowlink" href="#ch-depts" data-rv="fade" data-cursor>
            <span>See how we are built</span>
            <span className="ar">
              <svg viewBox="0 0 14 14" fill="none"><path d="M3 11 11 3M5 3h6v6" stroke="currentColor" strokeWidth="1.3" /></svg>
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
