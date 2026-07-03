import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Notre Dame Science Club (NDSC) | ndscbd.net — Official Website",
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
  ].join(", "),
  metadataBase: new URL("https://ndscbd.net"),
  alternates: { canonical: "https://ndscbd.net" },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: [
      { url: "/favicon.png", type: "image/png" },
    ],
    shortcut: "/favicon.png",
  },
  openGraph: {
    title: "Notre Dame Science Club (NDSC) | Official Website",
    description:
      "The first college-level science club of the Indian Subcontinent — promoting science, innovation, and curiosity since 1955. Science Sunday, Elucidation Hour, national festivals, workshops & more.",
    url: "https://ndscbd.net",
    siteName: "Notre Dame Science Club",
    locale: "en_BD",
    images: [
      {
        url: "https://ndscbd.net/images/cropped-logo.png",
        width: 1200,
        height: 630,
        alt: "Notre Dame Science Club — ndscbd.net",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Notre Dame Science Club (NDSC)",
    description:
      "Pioneer science club of the Indian Subcontinent since 1955 — ndscbd.net",
    images: ["https://ndscbd.net/images/cropped-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  verification: {},
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" sizes="any" />
        <link rel="icon" href="/images/cropped-logo.png" type="image/png" sizes="32x32" />
        <link rel="shortcut icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/favicon.png" sizes="180x180" />
      </head>
      <body suppressHydrationWarning>
        <Script id="ndsc-theme-init" strategy="beforeInteractive">
          {`
            (function(){
              var t = localStorage.getItem('ndsc-theme') || 'dark';
              if(t === 'light') document.documentElement.setAttribute('data-theme','light');
            })();
          `}
        </Script>
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}