/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Reduces macOS "EMFILE: too many open files" from native file watchers
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 2000,
        aggregateTimeout: 300,
      }
    }
    return config
  },
}

module.exports = nextConfig
