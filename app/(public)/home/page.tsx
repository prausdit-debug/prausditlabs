import Link from "next/link"
import { FlaskConical } from "lucide-react"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center px-6 py-12">
      
      {/* HEADER */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
          <FlaskConical className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold">Prausdit Research Lab</h1>
          <p className="text-xs text-muted-foreground">
            AI Agent Research & Development Environment
          </p>
        </div>
      </div>

      {/* HERO */}
      <section className="max-w-3xl text-center space-y-4">
        <h2 className="text-3xl font-bold">
          Internal AI Research Platform
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Prausdit Research Lab (PRAUSDIT) is a secure internal platform designed for 
          developers and researchers to build, test, and optimize AI-driven systems 
          and tools. This environment supports experimentation, automation workflows, 
          and advanced research pipelines.
        </p>

        <Link
          href="/sign-in"
          className="inline-block mt-4 px-6 py-2.5 rounded-lg bg-amber-500 text-black text-sm font-semibold hover:bg-amber-400 transition"
        >
          Sign In to Continue
        </Link>
      </section>

      {/* INFO CARDS */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 max-w-4xl w-full">
        
        <div className="border rounded-xl p-4 bg-zinc-900/40">
          <h3 className="text-sm font-semibold mb-2">🔬 Research Tools</h3>
          <p className="text-xs text-muted-foreground">
            Develop and experiment with AI agents, automation workflows, and 
            intelligent systems in a controlled environment.
          </p>
        </div>

        <div className="border rounded-xl p-4 bg-zinc-900/40">
          <h3 className="text-sm font-semibold mb-2">🔐 Secure Access</h3>
          <p className="text-xs text-muted-foreground">
            Access is restricted to authorized developers only. Authentication 
            ensures secure collaboration and data protection.
          </p>
        </div>

        <div className="border rounded-xl p-4 bg-zinc-900/40">
          <h3 className="text-sm font-semibold mb-2">⚙️ Internal Platform</h3>
          <p className="text-xs text-muted-foreground">
            This platform is not intended for public use. It is maintained for 
            internal development and research purposes only.
          </p>
        </div>

      </section>

      {/* DISCLAIMER */}
      <section className="max-w-2xl mt-12 text-center">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Prausdit Research Lab is an internal application. Access is granted only 
          to authorized users. Unauthorized use or access is strictly prohibited.
        </p>
      </section>

      {/* FOOTER (CRITICAL FOR GOOGLE ✅) */}
      <footer className="mt-16 text-center text-xs text-muted-foreground space-y-2">
        <div className="space-x-4">
          <Link href="/privacy-policy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
          <span>•</span>
          <Link href="/terms" className="underline hover:text-foreground">
            Terms & Conditions
          </Link>
        </div>

        <p>
          © {new Date().getFullYear()} Prausdit Research Lab (PRAUSDIT). All rights reserved.
        </p>
      </footer>

    </main>
  )
      }
