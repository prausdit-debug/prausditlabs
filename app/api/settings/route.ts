/**
 * GET  /api/settings  — return current AI + tool settings (any authenticated user)
 * POST /api/settings  — update settings (admin / super_admin only)
 *
 * FIXES:
 *  - API keys are now encrypted (AES-256-GCM) before being stored in the DB.
 *    Reads use the safe response builder which never returns raw key values.
 *  - getSuperAdminEmail() is now imported from lib/api-auth (single source).
 *  - getEffectiveRole() is replaced by getEffectiveUser() from lib/api-auth.
 */

import { NextResponse }  from "next/server"
import { auth }          from "@clerk/nextjs/server"
import { prisma }        from "@/lib/prisma"
import { getEffectiveUser } from "@/lib/api-auth"
import { encryptKey }    from "@/lib/crypto"
import { toApiError }    from "@/lib/errors"

const ADMIN_ROLES = new Set(["super_admin", "admin"])

// ─── Helper: safe settings response (NEVER leak raw keys) ────────────────────

function buildSettingsResponse(settings: Record<string, unknown> | null) {
  if (!settings) {
    return {
      defaultProvider:           "gemini",
      geminiDefaultModel:        "gemini-2.5-flash",
      selectedOpenRouterModels:  [],
      hasGeminiKey:              false,
      hasOpenRouterKey:          false,
      hasTavilyKey:              false,
      hasExaKey:                 false,
      hasSerpApiKey:             false,
      hasFirecrawlKey:           false,
      hasCrawl4aiUrl:            false,
      imageGenerationModel:      "auto",
      hasCloudinaryCloudName:    false,
      hasCloudinaryUploadPreset: false,
      hasCloudinaryApiKey:       false,
    }
  }

  return {
    id:                        settings.id,
    defaultProvider:           settings.defaultProvider,
    geminiDefaultModel:        settings.geminiDefaultModel,
    selectedOpenRouterModels:  settings.selectedOpenRouterModels,
    // Boolean flags only — raw key values are NEVER returned to the client
    hasGeminiKey:              !!settings.geminiApiKey,
    hasOpenRouterKey:          !!settings.openrouterApiKey,
    hasTavilyKey:              !!settings.tavilyApiKey,
    hasExaKey:                 !!settings.exaApiKey,
    hasSerpApiKey:             !!settings.serpApiKey,
    hasFirecrawlKey:           !!settings.firecrawlApiKey,
    hasCrawl4aiUrl:            !!settings.crawl4aiUrl,
    crawl4aiUrl:               settings.crawl4aiUrl || null,      // URL is not a secret
    imageGenerationModel:      (settings.imageGenerationModel as string) || "auto",
    hasCloudinaryCloudName:    !!settings.cloudinaryCloudName,
    hasCloudinaryUploadPreset: !!settings.cloudinaryUploadPreset,
    hasCloudinaryApiKey:       !!settings.cloudinaryApiKey,
    cloudinaryCloudName:       settings.cloudinaryCloudName || null, // cloud name is safe
  }
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    try {
      const settings = await prisma.aISettings.findFirst()
      return NextResponse.json(buildSettingsResponse(settings as Record<string, unknown> | null))
    } catch (dbErr) {
      console.error("[/api/settings GET] DB error:", {
        message: dbErr instanceof Error ? dbErr.message : String(dbErr),
      })
      return NextResponse.json(buildSettingsResponse(null))
    }
  } catch (err) {
    console.error("[/api/settings GET] Unexpected error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    // Use getEffectiveUser from lib/api-auth — no local duplicate
    const actor = await getEffectiveUser()
    if (!actor || !ADMIN_ROLES.has(actor.role)) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { userId } = await auth()
    const body = await req.json()

    const {
      defaultProvider,
      geminiApiKey,
      geminiDefaultModel,
      openrouterApiKey,
      selectedOpenRouterModels,
      tavilyApiKey,
      exaApiKey,
      serpApiKey,
      firecrawlApiKey,
      crawl4aiUrl,
      imageGenerationModel,
      cloudinaryCloudName,
      cloudinaryUploadPreset,
      cloudinaryApiKey,
    } = body

    const data: Record<string, unknown> = { updatedBy: userId }

    // ── Non-secret fields ─────────────────────────────────────────────────────
    if (defaultProvider          !== undefined) data.defaultProvider          = defaultProvider
    if (geminiDefaultModel       !== undefined) data.geminiDefaultModel       = geminiDefaultModel
    if (selectedOpenRouterModels !== undefined) data.selectedOpenRouterModels = selectedOpenRouterModels
    if (imageGenerationModel     !== undefined) data.imageGenerationModel     = imageGenerationModel || "auto"
    if (crawl4aiUrl              !== undefined) data.crawl4aiUrl              = crawl4aiUrl === "" ? null : crawl4aiUrl
    if (cloudinaryCloudName      !== undefined) data.cloudinaryCloudName      = cloudinaryCloudName  === "" ? null : cloudinaryCloudName

    // ── Secret fields: encrypt before storing ─────────────────────────────────
    if (geminiApiKey      && geminiApiKey      !== "") data.geminiApiKey      = encryptKey(geminiApiKey)
    if (openrouterApiKey  && openrouterApiKey  !== "") data.openrouterApiKey  = encryptKey(openrouterApiKey)
    if (tavilyApiKey      !== undefined) data.tavilyApiKey      = tavilyApiKey      === "" ? null : encryptKey(tavilyApiKey)
    if (exaApiKey         !== undefined) data.exaApiKey         = exaApiKey         === "" ? null : encryptKey(exaApiKey)
    if (serpApiKey        !== undefined) data.serpApiKey        = serpApiKey        === "" ? null : encryptKey(serpApiKey)
    if (firecrawlApiKey   !== undefined) data.firecrawlApiKey   = firecrawlApiKey   === "" ? null : encryptKey(firecrawlApiKey)
    if (cloudinaryUploadPreset !== undefined) data.cloudinaryUploadPreset = cloudinaryUploadPreset === "" ? null : cloudinaryUploadPreset
    if (cloudinaryApiKey  !== undefined) data.cloudinaryApiKey  = cloudinaryApiKey  === "" ? null : encryptKey(cloudinaryApiKey)

    const existing = await prisma.aISettings.findFirst()
    let settings

    if (existing) {
      settings = await prisma.aISettings.update({
        where: { id: existing.id },
        data,
      })
    } else {
      settings = await prisma.aISettings.create({
        data: data as Parameters<typeof prisma.aISettings.create>[0]["data"],
      })
    }

    return NextResponse.json({
      success: true,
      ...buildSettingsResponse(settings as Record<string, unknown>),
    })
  } catch (err) {
    console.error("[/api/settings POST] Error:", {
      message: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json(
      { error: toApiError(err, "api/settings POST") },
      { status: 500 }
    )
  }
}
