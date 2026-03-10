import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number | bigint): string {
  const n = typeof bytes === "bigint" ? Number(bytes) : bytes
  if (n === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(n) / Math.log(k))
  return `${parseFloat((n / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function formatNumber(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return n.toString()
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    COMPLETED: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    IN_PROGRESS: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    PENDING: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
    RUNNING: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    FAILED: "text-red-400 bg-red-400/10 border-red-400/20",
    CANCELLED: "text-zinc-500 bg-zinc-500/10 border-zinc-500/20",
    RAW: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
    CLEANING: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    CLEANED: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    FORMATTED: "text-violet-400 bg-violet-400/10 border-violet-400/20",
    AUGMENTED: "text-pink-400 bg-pink-400/10 border-pink-400/20",
    READY: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  }
  return map[status] ?? "text-zinc-400 bg-zinc-400/10 border-zinc-400/20"
}
