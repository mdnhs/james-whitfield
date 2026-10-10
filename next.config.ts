import type { NextConfig } from "next"

import { securityHeaders } from "./lib/tracking/csp"

// The s3 driver's public host (docs/brief.md §14). Read at build: Dokploy
// passes MEDIA_PUBLIC_URL as a build arg when the s3 driver is used.
function mediaRemotePatterns() {
  const raw = process.env.MEDIA_PUBLIC_URL
  if (!raw) return []
  const url = new URL(raw)
  return [
    {
      protocol: "https" as const,
      hostname: url.hostname,
      pathname: `${url.pathname.replace(/\/$/, "")}/**`,
    },
  ]
}

// "standalone" traces only the files the server needs, so the Docker image
// ships a small server.js instead of the full node_modules.
const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  compress: true,
  // Pages render from tag-cached data at request time (docs/brief.md §5.6).
  cacheComponents: true,
  // Metadata blocks for every user agent (docs/brief.md §5.6 rule 5): it is
  // cached, so this costs almost nothing, and crawlers always see full tags.
  // It also lets generateMetadata's notFound() set a real 404 status.
  htmlLimitedBots: /.*/,
  // One replica holds the whole tag cache in memory (docs/brief.md §5.6 rule 8).
  cacheMaxMemorySize: 128 * 1024 * 1024,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
    qualities: [75, 90],
    // Static assets and the local driver; anything else is refused.
    localPatterns: [
      { pathname: "/images/**", search: "" },
      { pathname: "/uploads/**", search: "" },
    ],
    remotePatterns: mediaRemotePatterns(),
  },
  // Ruling R9: the share-card route reads these at run time.
  outputFileTracingIncludes: {
    "/og/\\[\\[\\.\\.\\.path\\]\\]": ["./assets/fonts/*.ttf"],
  },
  // Ruling R1/R20. Computed at build: MEDIA_PUBLIC_URL is already a build arg.
  async headers() {
    const media = process.env.MEDIA_PUBLIC_URL
    return securityHeaders({
      dev: process.env.NODE_ENV === "development",
      mediaOrigin: media ? new URL(media).origin : null,
    })
  },
  experimental: {
    globalNotFound: true,
    optimizePackageImports: ["lucide-react", "three", "@gsap/react", "lenis"],
  },
}

export default nextConfig
