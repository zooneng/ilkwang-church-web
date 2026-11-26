import type { NextConfig } from "next";

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://images.unsplash.com https://i.ytimg.com https://*.supabase.co https://*.googleapis.com https://*.gstatic.com",
  "media-src 'self' blob: https://*.supabase.co",
  "connect-src 'self' https://*.supabase.co",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://www.google.com https://maps.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  cacheComponents: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  async rewrites() {
    const supabaseUrl = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
    if (!supabaseUrl) {
      return [];
    }
    const pubBase = `${supabaseUrl}/storage/v1/object/public/church-uploads`;
    return [
      {
        source: "/legacy-gallery/:path*",
        destination: `${pubBase}/legacy-gallery/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${pubBase}/:path*`,
      },
      {
        source: "/c01/:path*",
        destination: `${pubBase}/public-assets/c01/:path*`,
      },
      {
        source: "/ilkwang01.png",
        destination: `${pubBase}/public-assets/ilkwang01.png`,
      },
      {
        source: "/ilkwang02.png",
        destination: `${pubBase}/public-assets/ilkwang02.png`,
      },
      {
        source: "/ilkwang03.png",
        destination: `${pubBase}/public-assets/ilkwang03.png`,
      },
      {
        source: "/pastor.png",
        destination: `${pubBase}/public-assets/pastor.png`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: CONTENT_SECURITY_POLICY,
          },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
