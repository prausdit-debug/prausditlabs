import { AuthGuard } from "@/components/auth/auth-guard"
import { DashboardShell } from "@/components/layout/dashboard-shell"

/**
 * (dashboard) group layout
 * Wraps all protected UI pages with AuthGuard + DashboardShell.
 * DashboardShell handles: sidebar, header, project context, and project dialog.
 * API routes, sign-in, sign-up, and access-denied are NOT in this group.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <DashboardShell>
        {children}
      </DashboardShell>
    </AuthGuard>
  )
}
