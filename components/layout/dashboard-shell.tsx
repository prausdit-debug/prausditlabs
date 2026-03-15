"use client"

import { useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { ChatbotWidget } from "@/components/chatbot/chatbot-widget"
import { ProjectProvider } from "@/components/project/project-context"
import { CreateProjectDialog } from "@/components/project/create-project-dialog"

/**
 * DashboardShell - Client wrapper for dashboard that handles:
 * - Project context provider
 * - Project creation dialog state
 * - Layout with sidebar, header, and main content
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)

  return (
    <ProjectProvider>
      <div className="flex h-screen overflow-hidden bg-grid">
        <Sidebar onOpenProjectDialog={() => setProjectDialogOpen(true)} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header />
          <main 
            id="main-content" 
            className="flex-1 overflow-y-auto"
            role="main"
            aria-label="Main content"
          >
            <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
      <ChatbotWidget />
      <CreateProjectDialog 
        open={projectDialogOpen} 
        onClose={() => setProjectDialogOpen(false)} 
      />
    </ProjectProvider>
  )
}
