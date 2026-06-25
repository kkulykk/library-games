import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/library-games',
  images: { unoptimized: true },
  // Allow the dev server to serve _next resources (JS/HMR) to LAN origins, so the
  // app hydrates when opened via the network IP (e.g. phone testing) and not just
  // localhost. Dev-only; ignored by the static export build. Next matches these
  // per-dotted-segment, so use octet wildcards (NOT CIDR) to cover private ranges.
  allowedDevOrigins: ['192.168.*.*', '172.*.*.*', '10.*.*.*', '*.local'],
}

export default nextConfig
