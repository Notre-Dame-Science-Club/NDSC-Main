import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "uploads.ndscbd.net" },   // ✅ primary uploads domain
      { protocol: "https", hostname: "ndscbd.net" },            // legacy fallback
      { protocol: "https", hostname: "www.ndscbd.net" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "200mb" },
  },
  serverExternalPackages: ["@supabase/supabase-js", "@supabase/auth-js"],
};

export default nextConfig;
