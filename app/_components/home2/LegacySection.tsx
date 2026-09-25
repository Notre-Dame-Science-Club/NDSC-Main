import Link from "next/link";
import FounderPhoto from "./FounderPhoto";

/**
 * Chapter 1. Two beats, in order: first the club's own pitch with the link
 * into Departments (so "see how we are built" reads as a lead-in, not an
 * afterthought), then the founder profile below it.
 *
 * The founder photo is meant to be a transparent cut-out PNG, standing
 * directly on the scene the way KAGE lets its sanctuary show through the
 * word "KAGE" -- nothing behind it is a card or a solid fill. Swap the
 * placeholder <img> below for the real file at
 * /public/images/founder-cutout.png and nothing else needs to change.
 */
export default function LegacySection() {
  return (
    <section className="ch" id="ch-legacy" data-cosmos-chapter>
      <div className="ch-head" data-rv="fade">
        <span className="k"><b>01</b> — Who We Are</span>
        <span className="ch-rule" />
        <span className="k">EST. 1955</span>
      </div>

      <div className="ch-story-grid" style={{ marginBottom: "clamp(56px,9vh,110px)" }}>
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

      <div className="ch-founder-stage" data-rv="fade">
        <div className="ch-founder-wordmark" aria-hidden="true">NDSC</div>
        <span className="ch-founder-fg" aria-hidden="true" />
        <figure className="ch-founder-photo">
          {/* Placeholder silhouette -- replace src with the real transparent
              cut-out once it's ready; nothing else in this stage changes. */}
          <FounderPhoto />
          <figcaption>
            <b>Fr. Richard William Timm, C.S.C.</b>
            <span>Founder · 1955</span>
          </figcaption>
        </figure>
        <div className="ch-founder-bio">
          <p className="ch-body" data-rv="up">
            Holding the noble motto <strong>&quot;Science in Human Welfare,&quot;</strong> the eminent
            scientist <strong>Fr. Richard William Timm, C.S.C.</strong> inaugurated the flag of NDSC on{" "}
            <strong>September 18, 1955</strong>, alongside 19 founding student members. Seven decades
            on, NDSC remains the country&apos;s oldest and most prestigious scientific club — the
            trailblazer in spreading scientific awareness among the people.
          </p>
        </div>
      </div>
    </section>
  );
}
