import Link from "next/link"
import { FlaskConical } from "lucide-react"

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center">
      
      {/* HEADER */}
      <div className="flex items-center gap-2 mb-6">
        <FlaskConical className="w-6 h-6 text-amber-400" />
        <h1 className="text-lg font-bold">Prausdit Research Lab</h1>
      </div>

      {/* PURPOSE (THIS FIXES GOOGLE ISSUE ✅) */}
      <h2 className="text-2xl font-bold mb-3">
        Internal AI Development Platform
      </h2>

      <p className="max-w-xl text-sm text-muted-foreground leading-relaxed">
        Prausdit Research Lab (PRAUSDIT) is an internal platform designed for developers 
        to build, test, and optimize AI agents and automation tools. This platform is 
        used for research, development, and experimentation in artificial intelligence systems.
      </p>

      <p className="max-w-xl text-sm text-muted-foreground mt-3">
        Access is restricted to authorized users such as developers and administrators.
      </p>

      {/* LOGIN BUTTON */}
      <Link
        href="/sign-in"
        className="mt-6 px-5 py-2.5 bg-amber-500 text-black rounded-lg text-sm font-semibold"
      >
        Sign In
      </Link>

      {/* FOOTER (CRITICAL ✅) */}
      <div className="mt-10 text-xs text-muted-foreground space-x-4">
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>
        <span>•</span>
        <Link href="/terms" className="underline">
          Terms & Conditions
        </Link>
      </div>

    </main>
  )
      }
