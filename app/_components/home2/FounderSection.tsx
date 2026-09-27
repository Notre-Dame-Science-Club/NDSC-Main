/**
 * The founder profile — previously the second half of LegacySection, now
 * its own component so LegacyGallerySection can sit between the club's
 * intro and this. No data-cosmos-chapter: it rides the same camera
 * framing as the intro and the gallery immediately around it.
 *
 * The founder photo is meant to be a transparent cut-out PNG, standing
 * directly on the scene the way KAGE lets its sanctuary show through the
 * word "KAGE" — nothing behind it is a card or a solid fill. Swap the
 * placeholder <img> in FounderPhoto.tsx for the real file at
 * /public/images/founder-cutout.png and nothing else needs to change.
 */
import FounderPhoto from "./FounderPhoto";

export default function FounderSection() {
  return (
    <div className="ch" style={{ paddingTop: 0 }}>
      <div className="ch-founder-stage" data-rv="fade">
        <div className="ch-founder-wordmark" aria-hidden="true">NDSC</div>
        <span className="ch-founder-fg" aria-hidden="true" />
        <figure className="ch-founder-photo">
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
    </div>
  );
}
