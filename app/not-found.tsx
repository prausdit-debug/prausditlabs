import Link from "next/link"
import { Cpu, Home } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
        <Cpu className="w-8 h-8 text-amber-400" />
      </div>
      <h1 className="text-4xl font-bold font-mono text-foreground mb-2">404</h1>
      <p className="text-muted-foreground text-[15px] mb-6">This page does not exist in the research lab.</p>
      <Link
        href="/"
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-black text-[13px] font-semibold hover:bg-amber-400 transition-colors"
      >
        <Home className="w-4 h-4" />
        Back to Dashboard
      </Link>
    </div>
  )
}
