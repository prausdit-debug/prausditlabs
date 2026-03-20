import { Skeleton } from "@/components/ui/skeleton"

/**
 * Dashboard-level loading skeleton.
 * Shown by Next.js App Router while any (dashboard)/* page is loading its
 * server data. Matches the stat-card + content-panel layout used by most
 * dashboard pages so there's no jarring layout shift on load.
 */
export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-6 rounded-md" />
            </div>
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      {/* Main content panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-16" />
            </div>
            {[1, 2, 3].map((j) => (
              <div key={j} className="flex items-center gap-3 p-2 rounded-lg border border-border/50">
                <Skeleton className="h-8 w-8 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full flex-shrink-0" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
