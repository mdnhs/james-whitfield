import type { NextConfig } from "next"

// "standalone" traces only the files the server needs, so the Docker image
// ships a small server.js instead of the full node_modules.
const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "three", "@gsap/react", "lenis"],
  },
}

export default nextConfig
