import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "About Us | Notre Dame Science Club (NDSC)",
  description:
    "Learn about Notre Dame Science Club (NDSC) — founded 1955 by Fr. Richard William Timm, the pioneer science club of the Indian Subcontinent. History, departments, motto and goals.",
  alternates: { canonical: "https://ndscbd.net/about" },
  openGraph: {
    title: "About NDSC | Notre Dame Science Club",
    description: "Founded 1955 — the pioneer science club of the Indian Subcontinent.",
    url: "https://ndscbd.net/about",
    images: [{ url: "https://ndscbd.net/images/cropped-logo.png" }],
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
