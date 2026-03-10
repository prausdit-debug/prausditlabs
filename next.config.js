/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Required for Prisma to work correctly on Vercel (serverless)
  serverExternalPackages: ['@prisma/client', 'prisma'],
}

module.exports = nextConfig
