import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Activities | Notre Dame Science Club (NDSC)",
  description:
    "Explore all activities of Notre Dame Science Club — Events, Workshops, Elucidation Hour, Science Sunday, STEM Insights, Projects, Podcast, and Awards.",
  keywords: [
    "NDSC activities", "Science Sunday NDSC", "Elucidation Hour",
    "Notre Dame Science Club events", "NDSC workshops",
    "Notre Dame Science Festival", "NDSC podcast", "STEM Insights NDSC",
  ].join(", "),
  alternates: { canonical: "https://ndscbd.net/activities" },
  openGraph: {
    title: "Activities | Notre Dame Science Club (NDSC)",
    description: "Events, workshops, Science Sunday, STEM Insights, and more from NDSC.",
    url: "https://ndscbd.net/activities",
    images: [{ url: "https://ndscbd.net/images/cropped-logo.png" }],
    type: "website",
  },
};

export default function ActivitiesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
