/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Prisma v7 uses @prisma/adapter-pg (pure JS driver adapter).
  // Exclude native pg bindings that aren't available in Vercel's serverless runtime.
  serverExternalPackages: ["pg-native", "@prisma/adapter-pg", "pg"],
}

module.exports = nextConfig

