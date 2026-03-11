/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Prisma v7 uses @prisma/adapter-pg (pure JS driver adapter).
  // pg and @prisma/adapter-pg must be treated as server-external to prevent
  // Next.js from bundling native Node.js bindings unavailable in serverless.
  serverExternalPackages: ["pg", "pg-native", "@prisma/adapter-pg"],
}

module.exports = nextConfig
