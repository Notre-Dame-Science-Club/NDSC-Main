import type { NextConfig } from "next";

// Baseline response headers for every route.
//
// CSP ships as Report-Only first: the real script/style/font/connect sources
// (Google Fonts, KaTeX, Supabase, the NEXT_PUBLIC_WORKER_URL chatbot endpoint,
// Hostinger image hosts) need confirming in production before enforcing. Watch
// the browser console / a report endpoint, tighten, then rename the header to
// "Content-Security-Policy".
const workerOrigin = (() => {
  try { return process.env.NEXT_PUBLIC_WORKER_URL ? new URL(process.env.NEXT_PUBLIC_WORKER_URL).origin : "" } catch { return "" }
})();
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co ${workerOrigin}`.trim(),
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy-Report-Only", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "uploads.ndscbd.net" },   // primary uploads domain
      { protocol: "https", hostname: "ndscbd.net" },            // legacy fallback
      { protocol: "https", hostname: "www.ndscbd.net" },
      { protocol: "https", hostname: "arnob.ndscbd.net" },      // legacy — see lib/uploadUrl.ts normalizeUploadUrl
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "200mb" },
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/.well-known/assetlinks.json",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
  },
  serverExternalPackages: ["@supabase/supabase-js", "@supabase/auth-js"],
};

export default nextConfig;
