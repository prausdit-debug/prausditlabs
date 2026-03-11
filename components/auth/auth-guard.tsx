"use client"

/**
 * AuthGuard
 * ---------
 * Wraps every protected UI page. On mount it calls /api/users/me to:
 *   1. Auto-upsert the user into the DB (handles first login)
 *   2. Force-upgrade to super_admin if email matches SUPER_ADMIN_EMAIL env var
 *   3. Check the role returned and allow or deny access
 *
 * ACCESS RULES (evaluated server-side in /api/users/me):
 *   ALLOW  →  role === "super_admin" | "admin" | "developer"
 *   DENY   →  role === "user" or record not found → redirect to /access-denied
 *
 * NOTE: We do NOT sign-out here on denial. The user can choose to sign in with
 * a different account from the /access-denied page. This avoids an infinite
 * sign-out loop if /api/users/me itself has a transient error.
 */

import { useEffect, useState } from "react"
import { useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { Loader2, FlaskConical } from "lucide-react"

const ALLOWED_ROLES = new Set(["super_admin", "admin", "developer"])

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useUser()
  const router = useRouter()
  const [status, setStatus] = useState<"loading" | "allowed" | "denied">("loading")

  useEffect(() => {
    if (!isLoaded) return

    if (!isSignedIn) {
      router.replace("/sign-in")
      return
    }

    // Call /api/users/me — this will:
    //   • auto-create the user if they don't exist yet
    //   • force-upgrade email-matched users to super_admin
    //   • return the current role
    fetch("/api/users/me")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          console.warn("[AuthGuard] /api/users/me error:", res.status, body)
          return null
        }
        return res.json()
      })
      .then((user) => {
        if (!user) {
          // API error — redirect to access-denied (user can sign out from there)
          router.replace("/access-denied")
          return
        }

        console.log("[AuthGuard] user role:", user.role, "email:", user.email)

        if (ALLOWED_ROLES.has(user.role)) {
          setStatus("allowed")
        } else {
          // Role not permitted — send to access-denied (sign-out happens there)
          router.replace("/access-denied")
        }
      })
      .catch((err) => {
        console.error("[AuthGuard] fetch error:", err)
        router.replace("/access-denied")
      })
  }, [isLoaded, isSignedIn, router])

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
    return null
  }

  return <>{children}</>
}
