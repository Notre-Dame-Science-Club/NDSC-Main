import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Publication | Notre Dame Science Club (NDSC)",
  description:
    "Read AUDRI — the annual science magazine of Notre Dame Science Club. Science articles on Quantum Physics, CRISPR, Neural Networks, and more. Free to read online.",
  alternates: { canonical: "https://ndscbd.net/publication" },
  openGraph: {
    title: "Publication | NDSC — AUDRI Magazine",
    description: "Annual science magazine of Notre Dame Science Club. Free to read online.",
    url: "https://ndscbd.net/publication",
    images: [{ url: "https://ndscbd.net/images/cropped-logo.png" }],
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
