/**
 * Central site configuration.
 *
 * Anything that's a "fact about the site" rather than a piece of UI logic
 * belongs here: name, URL, SEO defaults, contact details, cookie names.
 * Pages and API routes should import from here instead of repeating these
 * literals — that way a rebrand, domain change, or cookie rename only
 * touches one file.
 */

export const site = {
  name: "Notre Dame Science Club",
  shortName: "NDSC",
  url: "https://ndscbd.net",
  foundedYear: 1955,
  tagline: "Pioneer science club of the Indian Subcontinent since 1955",
  logo: "https://ndscbd.net/images/cropped-logo.png",
  favicon: "/favicon.png",
} as const;

export const seo = {
  title: `${site.name} (${site.shortName}) | ndscbd.net — Official Website`,
  description:
    "Official website of Notre Dame Science Club (NDSC) — the pioneer science club of the Indian Subcontinent, founded in 1955 at Notre Dame College, Dhaka. Join Science Sunday, Elucidation Hour, workshops, sessions, national science festival, intra science festival, and more.",
  keywords: [
    "Notre Dame Science Club",
    "NDSC",
    "ndscbd",
    "ndscbd.net",
    "Notre Dame College",
    "Notre Dame science club",
    "Notre Dame College Science Club",
    "notre dame college dhaka",
    "science club bangladesh",
    "science club dhaka",
    "NDSC Bangladesh",
    "Elucidation Hour",
    "Science Sunday",
    "ndsc workshops",
    "ndsc sessions",
    "Notre Dame Fest",
    "Notre Dame Festival",
    "Notre Dame Science Festival",
    "National Science Technology Week",
    "জাতীয় বিজ্ঞান ও প্রযুক্তি সপ্তাহ",
    "Tech Intro",
    "Intra Science Festival",
    "NDSC olympiad",
    "science olympiad bangladesh",
    "pioneer science club indian subcontinent",
    "notre dame math club",
  ],
  ogImage: {
    url: "https://ndscbd.net/images/cropped-logo.png",
    width: 1200,
    height: 630,
    alt: "Notre Dame Science Club — ndscbd.net",
  },
} as const;

export const contact = {
  adminEmail: "admin@ndscbd.net",
  announcementsEmail: "announcements@ndscbd.net",
  announcementFallbackSender: "NDSC <onboarding@resend.dev>",
} as const;

/** Cookie names used by the various auth flows — keep these in one place
 *  so a rename doesn't require hunting through every route file. */
export const authCookies = {
  admin: "admin_session",
  organizer: "organizer_session",
  activityTeam: "activity_team_session",
} as const;

const config = { site, seo, contact, authCookies };
export default config;
