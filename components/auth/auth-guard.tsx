"use client"

/**
 * AuthGuard
 * ---------
 * Wraps every protected UI page.
 *
 * ACCESS RULES:
 *   ALLOW → role === "super_admin" | "admin" | "developer"
 *   DENY  → role === "user" → redirect to /access-denied
 *
 * /api/users/me handles the super_admin upgrade automatically on every call,
 * so even if the DB had the wrong role it gets fixed before this check runs.
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

    fetch("/api/users/me")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          console.error("[AuthGuard] /api/users/me failed:", res.status, body)
          return null
        }
        return res.json()
      })
      .then((user) => {
        if (!user) {
          router.replace("/access-denied")
          return
        }

        // Log clearly so you can see in browser DevTools > Console
        console.log(
          `[AuthGuard] email=${user.email} | role=${user.role} | allowed=${ALLOWED_ROLES.has(user.role)}`
        )

        if (ALLOWED_ROLES.has(user.role)) {
          setStatus("allowed")
        } else {
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

  if (status === "denied") return null

  return <>{children}</>
}
