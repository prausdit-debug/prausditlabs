import type { Metadata } from "next"
import "./globals.css"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { ChatbotWidget } from "@/components/chatbot/chatbot-widget"

export const metadata: Metadata = {
  title: "PyCode-SLM Research Dashboard",
  description: "AI Research Lab — Python Small Language Model Development Platform",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground antialiased">
        <div className="flex h-screen overflow-hidden bg-grid">
          {/* Sidebar */}
          <Sidebar />

          {/* Main content */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto">
              <div className="p-6 max-w-[1400px] mx-auto">
                {children}
              </div>
            </main>
          </div>
        </div>

        {/* Floating AI Chatbot */}
        <ChatbotWidget />
      </body>
    </html>
  )
}
