import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import "katex/dist/katex.min.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SurveyNotification from "@/components/SurveyNotification";
import ActivityNotification from "@/components/ActivityNotification";
import { supabaseAdmin } from "@/lib/supabase";
import { darkenHex, hexToRgbString, isValidHex } from "@/lib/color";

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

const HEADER_SIZES: Record<string, { height: string; logo: string }> = {
  compact: { height: "56px", logo: "32px" },
  default: { height: "64px", logo: "38px" },
  large: { height: "76px", logo: "46px" },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Site-wide Appearance settings (Admin > Appearance) — stored as extra rows
  // in homepage_settings (keys: default_theme, font_family, font_google_url,
  // header_size, accent_color). Fetched server-side so they're baked into the
  // first response instead of flashing in after a client-side fetch.
  let appearanceRows: { key: string; value: string }[] | null = null;
  try {
    const res = await supabaseAdmin
      .from("homepage_settings")
      .select("key, value")
      .in("key", ["default_theme", "font_family", "font_google_url", "header_size", "accent_color"]);
    appearanceRows = res.data as any;
  } catch {
    // Falls back to defaults rather than breaking every page.
  }
  const appearance: Record<string, string> = {};
  for (const row of appearanceRows || []) appearance[row.key] = row.value;
  const headerSize = HEADER_SIZES[appearance.header_size || "default"] || HEADER_SIZES.default;
  const rootStyle: React.CSSProperties & Record<string, string> = {
    "--navbar-height": headerSize.height,
    "--navbar-logo": headerSize.logo,
  };
  if (appearance.font_family) {
    rootStyle["--font-body"] = appearance.font_family;
    rootStyle["--font-heading"] = appearance.font_family;
  }
  if (appearance.accent_color && isValidHex(appearance.accent_color)) {
    const accent = appearance.accent_color.startsWith("#") ? appearance.accent_color : `#${appearance.accent_color}`;
    rootStyle["--blue"] = accent;
    rootStyle["--blue2"] = darkenHex(accent, 0.3);
    rootStyle["--glow"] = `${accent}55`;
    rootStyle["--blue-rgb"] = hexToRgbString(accent);
  }

  return (
    <html lang="en" suppressHydrationWarning style={rootStyle}>
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" sizes="any" />
        <link rel="icon" href="/images/cropped-logo.png" type="image/png" sizes="32x32" />
        <link rel="shortcut icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/favicon.png" sizes="180x180" />
        {appearance.font_google_url && (
          <link rel="stylesheet" href={appearance.font_google_url} />
        )}
      </head>
      <body suppressHydrationWarning>
        <Script id="ndsc-theme-init" strategy="beforeInteractive">
          {`
            (function(){
              var t = localStorage.getItem('ndsc-theme') || ${JSON.stringify(appearance.default_theme === "light" ? "light" : "dark")};
              if(t === 'light') document.documentElement.setAttribute('data-theme','light');
            })();
          `}
        </Script>
        <Navbar />
        <main>{children}</main>
        <Footer />
        <SurveyNotification />
        <ActivityNotification />
      </body>
    </html>
  );
}