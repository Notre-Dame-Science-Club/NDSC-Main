import NDSCBot from "@/components/NDSCBot";

import "./_components/home2/home2.css";
import Hero from "./_components/home2/Hero";
import StatsStrip from "./_components/home2/StatsStrip";
import LegacySection from "./_components/home2/LegacySection";
import LegacyGallerySection from "./_components/home2/LegacyGallerySection";
import FounderSection from "./_components/home2/FounderSection";
import DepartmentsSection from "./_components/home2/DepartmentsSection";
import GlanceGallerySection from "./_components/home2/GlanceGallerySection";
import ActivitiesMarquee from "./_components/home2/ActivitiesMarquee";
import LeadersSection from "./_components/home2/LeadersSection";
import MediaSection from "./_components/home2/MediaSection";
import AudriSection from "./_components/home2/AudriSection";
import JoinSection from "./_components/home2/JoinSection";
import HomeChrome from "./_components/home2/HomeChrome";

/**
 * The homepage. Deliberately thin — every chapter is its own component
 * under app/_components/home2/, each one commented with which endpoint (if
 * any) it reads from, so a future change to "the departments section" or
 * "the activities feed" means opening exactly one file, not searching this
 * one for the right <section>.
 *
 * Two chapters (LegacySection, DepartmentsSection) now have extra content
 * riding along right after them — LegacyGallerySection + FounderSection
 * after the intro, GlanceGallerySection after Departments. None of those
 * extra pieces carry their own data-cosmos-chapter: like StatsStrip, they
 * ride the camera framing of the chapter they sit inside rather than
 * needing the whole rig re-tuned for a new waypoint.
 *
 * The scroll-driven camera in the cosmos backdrop (mounted site-wide by
 * <ThemeProvider>, see components/theme/SiteBackdrop.tsx) flies between
 * whichever elements carry data-cosmos-chapter, in DOM order — that's
 * every <section> below, plus the site <Footer> as the final chapter. The
 * small progress rail on the right and all the scroll-triggered reveals
 * are wired up once by <HomeChrome>, at the bottom of this file, rather
 * than duplicated inside each section.
 */
const CHAPTERS = [
  { id: "ch-hero", label: "Hero" },
  { id: "ch-legacy", label: "The Pioneer" },
  { id: "ch-depts", label: "Departments" },
  { id: "ch-activities", label: "Activities" },
  { id: "ch-leaders", label: "Leadership" },
  { id: "ch-media", label: "Science Media" },
  { id: "ch-audri", label: "AUDRI" },
  { id: "ch-join", label: "Join Us" },
  { id: "ch-footer", label: "Colophon" },
];

export default function HomePage() {
  return (
    <div className="cosmos-home">
      <Hero />
      <StatsStrip />
      <LegacySection />
      <LegacyGallerySection />
      <FounderSection />
      <DepartmentsSection />
      <GlanceGallerySection />
      <ActivitiesMarquee />
      <LeadersSection />
      <MediaSection />
      <AudriSection />
      <JoinSection />

      <HomeChrome chapters={CHAPTERS} />
      <NDSCBot />
    </div>
  );
}
