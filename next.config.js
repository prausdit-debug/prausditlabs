/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Prisma requires these packages to be bundled server-side (Vercel serverless)
  serverExternalPackages: ["@prisma/client", "prisma"],
}

module.exports = nextConfig
