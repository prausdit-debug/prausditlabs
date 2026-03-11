"use client"

/**
 * AuthGuard
 * ---------
 * Wraps every protected UI page. On mount it calls /api/users/me to get the
 * current user's role from the database and applies the access rules:
 *
 *   ALLOW  →  email === SUPPER_ADMIN_EMAIL  (checked server-side in the API)
 *   ALLOW  →  role === "admin" | "developer" | "super_admin"
 *   DENY   →  everything else → sign out → /access-denied
 *
 * API routes (/api/*) are never touched by this guard.
 */

import { useEffect, useState } from "react"
import { useUser, useClerk } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { Loader2, FlaskConical } from "lucide-react"

const ALLOWED_ROLES = new Set(["super_admin", "admin", "developer"])

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useUser()
  const { signOut } = useClerk()
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">("loading")

  useEffect(() => {
    if (!isLoaded) return

    // Not signed in — middleware already redirects, but handle edge cases
    if (!isSignedIn) {
      router.replace("/sign-in")
      return
    }

    // Fetch the user's DB record (includes role + super-admin flag)
    fetch("/api/users/me")
      .then(async (res) => {
        if (!res.ok) {
          // User not in DB yet — deny
          return null
        }
        return res.json()
      })
      .then(async (user) => {
        if (!user) {
          await signOut()
          router.replace("/access-denied")
          return
        }

        // Allow if role is permitted
        if (ALLOWED_ROLES.has(user.role)) {
          setStatus("allowed")
        } else {
          // Unauthorised role — log out and redirect
          await signOut()
          router.replace("/access-denied")
        }
      })
      .catch(async () => {
        await signOut()
        router.replace("/access-denied")
      })
  }, [isLoaded, isSignedIn, signOut, router])

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-md bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-[13px] font-mono">Verifying access…</span>
          </div>
        </div>
      </div>
    )
  }

  if (status === "denied") {
    // Will redirect — render nothing
    return null
  }

  return <>{children}</>
}
