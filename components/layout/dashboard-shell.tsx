"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { ChatbotWidget } from "@/components/chatbot/chatbot-widget"
import { ProjectProvider } from "@/components/project/project-context"
import { CreateProjectDialog } from "@/components/project/create-project-dialog"

/**
 * DashboardShell — client wrapper for all protected dashboard pages.
 *
 * Handles:
 * - ProjectProvider (project context for all pages)
 * - Sidebar + Header layout
 * - Content area with conditional padding:
 *     /chat → no padding, overflow-hidden (the page manages its own full-height layout)
 *     all other routes → p-4 md:p-6 with max-width container
 * - Floating ChatbotWidget (suppressed on /chat — it has its own full UI)
 * - CreateProjectDialog
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const pathname = usePathname()

  // The fullscreen chat page manages its own layout — don't wrap it in padding
  const isFullscreenChat = pathname === "/chat"

  return (
    <ProjectProvider>
      <div className="flex h-screen overflow-hidden bg-grid">
        <Sidebar onOpenProjectDialog={() => setProjectDialogOpen(true)} />

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header />

          <main
            id="main-content"
            className="flex-1 min-h-0 overflow-hidden"
            role="main"
            aria-label="Main content"
          >
            {isFullscreenChat ? (
              // Chat page: no padding, fill remaining space exactly
              <div className="h-full overflow-hidden">
                {children}
              </div>
            ) : (
              // All other dashboard pages: scrollable with padding + max-width
              <div className="h-full overflow-y-auto">
                <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
                  {children}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Floating AI widget — hide on the fullscreen chat page (it has its own chat UI) */}
      {!isFullscreenChat && <ChatbotWidget />}

      <CreateProjectDialog
        open={projectDialogOpen}
        onClose={() => setProjectDialogOpen(false)}
      />
    </ProjectProvider>
  )
}
