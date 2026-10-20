import type { NextConfig } from "next";

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
