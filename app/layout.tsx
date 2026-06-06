import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Notre Dame Science Club (NDSC) | Official Website",
  description:
    "Official website of Notre Dame Science Club (NDSC), founded in 1955. The first college-level science club in the Indian Subcontinent. Promoting science, olympiads, innovation, and scientific curiosity in Bangladesh.",
  keywords:
    "Notre Dame Science Club, NDSC, Notre Dame College, NDSC Bangladesh, Science Club Dhaka",
  openGraph: {
    title: "Notre Dame Science Club (NDSC) | Official Website",
    description:
      "Official website of Notre Dame Science Club (NDSC), promoting science, olympiads, innovation, and scientific curiosity in Bangladesh.",
    url: "https://ndscbd.net",
    siteName: "Notre Dame Science Club",
    images: [{ url: "https://ndscbd.net/images/cropped-logo.png" }],
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{__html: `
          (function(){
            var t = localStorage.getItem('ndsc-theme') || 'dark';
            if(t === 'light') document.documentElement.setAttribute('data-theme','light');
          })();
        `}} />
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}