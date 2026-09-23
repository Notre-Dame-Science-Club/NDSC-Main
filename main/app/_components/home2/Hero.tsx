import Link from "next/link";

/**
 * Chapter 0. The wide, flat framing the cosmos rig opens on — see
 * lib/cosmos/rig.ts CAM[0]. Everything here is static markup; the fades
 * and the hero-exit scroll behaviour are wired up once, site-wide for this
 * page, by <HomeChrome> (see app/_components/home2/HomeChrome.tsx).
 */
export default function Hero() {
  return (
    <section className="ch-hero-sec" id="ch-hero" data-cosmos-chapter>
      <div className="ch-hero-top">
        <div className="ch-eyebrow" data-rv="fade">
          <span className="ch-dot" /> Chapter 00 — The Pioneer
        </div>
        <h1 className="ch-display ch-hero">
          <span className="ch-mask" data-rv="up"><span>Join the community</span></span>
          <span className="ch-mask" data-rv="up"><span>of science</span></span>
          <span className="ch-mask" data-rv="up"><span><em>enthusiasts.</em></span></span>
        </h1>
        <p className="ch-hero-sub ch-body" data-rv="up">
          The first college-level science club in South Asia — shaping scientists, innovators and
          leaders for seventy years.
        </p>
        <div className="ch-hero-btns" data-rv="up">
          <Link className="ch-btn ch-btn-solid" href="/activities" data-cursor>
            View Activities
          </Link>
          <Link className="ch-btn ch-btn-ghost" href="/auth/signup" data-cursor>
            <i />
            <span>Join Us</span>
          </Link>
        </div>
      </div>

      <div className="ch-hero-spacer" />

      <div className="ch-hero-foot">
        <div className="ch-hero-cue" data-rv="fade">
          <span>Scroll to launch</span>
          <span className="track"><i /></span>
        </div>
        <div className="ch-chips">
          <div className="ch-chip" data-rv="up"><span className="num">70+</span><b>Years of Legacy</b></div>
          <div className="ch-chip" data-rv="up"><span className="num">20,000+</span><b>Members &amp; Alumni</b></div>
          <div className="ch-chip" data-rv="up"><span className="num">1,000+</span><b>Workshops</b></div>
          <div className="ch-chip" data-rv="up"><span className="num">1st</span><b>In South Asia</b></div>
        </div>
      </div>

      <div className="ch-hero-side" data-rv="up">
        <span className="v">SCIENCE IN HUMAN WELFARE</span>
      </div>
    </section>
  );
}
