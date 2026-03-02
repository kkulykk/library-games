import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/library-games',
  images: { unoptimized: true },
}

export default nextConfig
