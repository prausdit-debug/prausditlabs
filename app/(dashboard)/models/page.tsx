import { prisma } from "@/lib/prisma"
import { formatBytes, formatNumber } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { Package, CheckCircle, BarChart3 } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function ModelsPage() {
  let models: Awaited<ReturnType<typeof prisma.modelVersion.findMany<{ include: { experiment: { select: { name: true } } } }>>> = []

  try {
    models = await prisma.modelVersion.findMany({
      orderBy: { createdAt: "desc" },
      include: { experiment: { select: { name: true } } },
    })
  } catch (error) {
    console.error("ModelsPage DB error:", error)
  }

  const quantColors: Record<string, string> = {
    NONE: "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
    INT8: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    INT4: "text-violet-400 bg-violet-400/10 border-violet-400/20",
    GPTQ: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    GGUF: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    AWQ: "text-pink-400 bg-pink-400/10 border-pink-400/20",
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 text-[12px] text-muted-foreground font-mono mb-2">
          <span className="text-amber-500">▸</span> VERSIONING
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Model Versions</h1>
        <p className="text-[14px] text-muted-foreground mt-1">
          {models.length} trained versions · {models.filter(m => m.isDeployed).length} deployed
        </p>
      </div>

      {/* Model cards */}
      <div className="space-y-4">
        {models.map(model => (
          <div key={model.id} className={cn(
            "rounded-xl border bg-card p-5",
            model.isDeployed ? "border-emerald-500/30 bg-emerald-500/3" : "border-border"
          )}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                <Package className="w-5 h-5 text-violet-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[15px] font-semibold text-foreground">{model.name}</h3>
                  <span className="text-[13px] font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                    {model.version}
                  </span>
                  {model.isDeployed && (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      <CheckCircle className="w-3 h-3" /> DEPLOYED
                    </span>
                  )}
                  {model.quantization && (
                    <span className={cn("text-[11px] font-mono px-2 py-0.5 rounded border", quantColors[model.quantization])}>
                      {model.quantization}
                    </span>
                  )}
                </div>
                {model.description && (
                  <p className="text-[13px] text-muted-foreground mt-1">{model.description}</p>
                )}
                {model.experiment && (
                  <p className="text-[12px] text-muted-foreground mt-1">
                    From experiment: <span className="text-foreground">{model.experiment.name}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-4">
              {[
                ["Parameters", model.parameterCount ? formatNumber(Number(model.parameterCount)) : "–"],
                ["File Size", model.fileSizeBytes ? formatBytes(Number(model.fileSizeBytes)) : "–"],
                ["Format", model.deploymentFormat ?? "–"],
                ["HumanEval", model.pass1Score ? `${(model.pass1Score * 100).toFixed(1)}%` : "–"],
                ["BLEU", model.bleuScore ? model.bleuScore.toFixed(3) : "–"],
                ["HumanEval MMLU", model.mmluScore ? `${(model.mmluScore * 100).toFixed(1)}%` : "–"],
              ].map(([label, value]) => (
                <div key={label} className="bg-muted/50 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                  <p className="text-[14px] font-bold font-mono text-foreground mt-1">{value}</p>
                </div>
              ))}
            </div>

            {/* Benchmark bars */}
            {(model.pass1Score || model.bleuScore) && (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  <p className="text-[12px] text-muted-foreground">Benchmark Scores</p>
                </div>
                {model.pass1Score && (
                  <div>
                    <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                      <span>HumanEval pass@1</span>
                      <span className="font-mono text-amber-400">{(model.pass1Score * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${model.pass1Score * 100}%` }} />
                    </div>
                  </div>
                )}
                {model.bleuScore && (
                  <div>
                    <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                      <span>BLEU Score</span>
                      <span className="font-mono text-violet-400">{model.bleuScore.toFixed(3)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-violet-500 rounded-full" style={{ width: `${model.bleuScore * 100}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {model.notes && (
              <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-[12px] text-muted-foreground">{model.notes}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
