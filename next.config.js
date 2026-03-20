/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },

  // Tell Turbopack/Next.js NOT to bundle these — use Node's native require instead.
  serverExternalPackages: [
    "pg",
    "pg-native",
    "@prisma/adapter-pg",
    "@prisma/client",
    ".prisma/client",
  ],

  // NOTE: keep false if TipTap v3 shows Strict Mode regressions;
  // otherwise set to true for better concurrent-rendering warnings.
  reactStrictMode: false,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
      // Cloudinary CDN — used by agent-generated images
      { protocol: "https", hostname: "res.cloudinary.com" },
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

  // ─── Security headers ───────────────────────────────────────────────────────
  // Applied to every response. Mitigates clickjacking, MIME-sniffing, and
  // amplifies XSS severity if it ever occurs.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent this app from being embedded in iframes (clickjacking)
          { key: "X-Frame-Options",        value: "DENY" },
          // Prevent browsers guessing content types (MIME sniffing)
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Control referrer information sent to external sites
          { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
          // Enforce HTTPS for 2 years (only takes effect when served over HTTPS)
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          // Disable unused browser features
          {
            key:   "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
