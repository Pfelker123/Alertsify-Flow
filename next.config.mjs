/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    // Flow Map and Heat Map were the same strike x expiry board twice —
    // consolidated onto Heat Map. Keep old links/bookmarks working.
    return [{ source: '/flow-map', destination: '/heatmap', permanent: true }]
  },
}

export default nextConfig
