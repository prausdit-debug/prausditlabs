import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"

/**
 * PUBLIC routes — no auth required.
 * /api/* is intentionally public so AI agents (Gemini, etc.) can read/write freely.
 */
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/access-denied(.*)",
  // All API routes are public — agents must never be blocked
  "/api(.*)",
])

export default clerkMiddleware(async (auth, req) => {
  // API routes and public pages — always allow through
  if (isPublicRoute(req)) return NextResponse.next()

  // For all UI pages require a Clerk session
  const { userId, redirectToSignIn } = await auth()

  if (!userId) {
    return redirectToSignIn({ returnBackUrl: req.url })
  }

  // Role enforcement happens in the AuthGuard React component (needs DB access).
  // Middleware only checks authentication; role checks run at layout level.
  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    // Always run for API routes (will pass through as public above)
    "/(api|trpc)(.*)",
  ],
}
