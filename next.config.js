/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'tmssl.akamaized.net',
        pathname: '/**',
      },
    ],
  },
}

module.exports = nextConfig
