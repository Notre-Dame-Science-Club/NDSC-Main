import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "ndscbd.net" },
      { protocol: "https", hostname: "www.ndscbd.net" },
      { protocol: "https", hostname: "uploads.ndscbd.net" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: "50mb" },
  },
  serverExternalPackages: ["@supabase/supabase-js", "@supabase/auth-js"],
};

export default nextConfig;
