import type { NextConfig } from "next"

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
  },
  experimental: {
    globalNotFound: true,
    optimizePackageImports: ["lucide-react", "three", "@gsap/react", "lenis"],
  },
}

export default nextConfig
