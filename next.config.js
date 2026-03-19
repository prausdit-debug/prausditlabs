/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },

  // Tell Turbopack/Next.js NOT to bundle these — use Node's native require instead.
  // This is required for:
  //   - pg / pg-native (native Node.js bindings)
  //   - @prisma/adapter-pg (uses pg under the hood)
  //   - The generated Prisma client (lives outside node_modules, Turbopack
  //     cannot bundle generated code outside of node_modules reliably)
  serverExternalPackages: [
    "pg",
    "pg-native",
    "@prisma/adapter-pg",
    "@prisma/client",
    ".prisma/client",
  ],

  // Disable React strict mode for TipTap compatibility
  reactStrictMode: false,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
    ],
  },

  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-icons",
      "recharts",
      "framer-motion",
    ],
  },
}

module.exports = nextConfig
