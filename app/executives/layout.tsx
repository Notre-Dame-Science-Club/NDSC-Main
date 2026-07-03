import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Executive Panel | Notre Dame Science Club (NDSC)",
  description:
    "Meet the executive panels of Notre Dame Science Club from 1978 to present. General Secretary, Presidents, and all committee members across all panels.",
  alternates: { canonical: "https://ndscbd.net/executives" },
  openGraph: {
    title: "Executive Panel | NDSC",
    description: "All executive panels of NDSC from 1978 to present.",
    url: "https://ndscbd.net/executives",
    images: [{ url: "https://ndscbd.net/images/cropped-logo.png" }],
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
