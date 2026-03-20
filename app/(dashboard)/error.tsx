"use client"

import { useEffect } from "react"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import Link from "next/link"

/**
 * Dashboard-level error boundary.
 * Catches errors thrown in any (dashboard)/* page during rendering or
 * server-side data fetching. Provides a reset action and a home link
 * so users can recover without a full page reload.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to your error monitoring service here (e.g. Sentry)
    console.error("[Dashboard Error]", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center">
      <div
        className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4"
        aria-hidden="true"
      >
        <AlertTriangle className="w-7 h-7 text-red-400" />
      </div>

      <h1 className="text-lg font-semibold text-foreground mb-1" role="alert">
        Page failed to load
      </h1>
      <p className="text-sm text-muted-foreground mb-1 max-w-sm">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      {error.digest && (
        <p className="text-[11px] text-muted-foreground/60 mb-5 font-mono">
          Error ID: {error.digest}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try again
        </button>
        <Link
          href="/"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted border border-border text-sm text-foreground hover:bg-accent transition-colors"
        >
          <Home className="w-3.5 h-3.5" />
          Dashboard
        </Link>
      </div>
    </div>
  )
}
