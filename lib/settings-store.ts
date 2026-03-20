/**
 * lib/settings-store.ts — Single point for reading AI settings with decryption.
 *
 * WHY: api-keys are now stored AES-256-GCM encrypted (see lib/crypto.ts).
 * All callers that previously called `prisma.aISettings.findFirst()` directly
 * now call `getAISettingsDecrypted()` instead, so decryption is centralised.
 *
 * BACKWARD COMPATIBLE: `decryptKey()` returns plaintext values unchanged if
 * they are not in the encrypted format, so existing un-encrypted rows continue
 * to work without a migration.
 */

import { prisma } from "./prisma"
import { decryptKey } from "./crypto"

export interface AISettingsDecrypted {
  id:                      string
  defaultProvider:         string
  geminiDefaultModel:      string
  selectedOpenRouterModels: string[]
  geminiApiKey:            string | null
  openrouterApiKey:        string | null
  tavilyApiKey:            string | null
  exaApiKey:               string | null
  serpApiKey:              string | null
  firecrawlApiKey:         string | null
  crawl4aiUrl:             string | null   // URL — not a secret, stored plain
  imageGenerationModel:    string
  cloudinaryCloudName:     string | null   // cloud name — not a secret
  cloudinaryUploadPreset:  string | null
  cloudinaryApiKey:        string | null
}

const DEFAULT_SETTINGS: Omit<AISettingsDecrypted, "id"> = {
  defaultProvider:          "gemini",
  geminiDefaultModel:       "gemini-2.5-flash",
  selectedOpenRouterModels: [],
  geminiApiKey:             null,
  openrouterApiKey:         null,
  tavilyApiKey:             null,
  exaApiKey:                null,
  serpApiKey:               null,
  firecrawlApiKey:          null,
  crawl4aiUrl:              null,
  imageGenerationModel:     "auto",
  cloudinaryCloudName:      null,
  cloudinaryUploadPreset:   null,
  cloudinaryApiKey:         null,
}

/**
 * Read AI settings from the database and decrypt all encrypted API keys.
 * Returns null if the DB is unreachable or no settings row exists.
 */
export async function getAISettingsDecrypted(): Promise<AISettingsDecrypted | null> {
  try {
    const s = await prisma.aISettings.findFirst()
    if (!s) return null

    return {
      id:                      s.id,
      defaultProvider:         s.defaultProvider        || DEFAULT_SETTINGS.defaultProvider,
      geminiDefaultModel:      s.geminiDefaultModel     || DEFAULT_SETTINGS.geminiDefaultModel,
      selectedOpenRouterModels: s.selectedOpenRouterModels ?? [],
      geminiApiKey:            s.geminiApiKey      ? decryptKey(s.geminiApiKey)      : null,
      openrouterApiKey:        s.openrouterApiKey  ? decryptKey(s.openrouterApiKey)  : null,
      tavilyApiKey:            s.tavilyApiKey      ? decryptKey(s.tavilyApiKey)      : null,
      exaApiKey:               s.exaApiKey         ? decryptKey(s.exaApiKey)         : null,
      serpApiKey:              s.serpApiKey        ? decryptKey(s.serpApiKey)        : null,
      firecrawlApiKey:         s.firecrawlApiKey   ? decryptKey(s.firecrawlApiKey)   : null,
      crawl4aiUrl:             s.crawl4aiUrl       || null,
      imageGenerationModel:    s.imageGenerationModel || "auto",
      cloudinaryCloudName:     s.cloudinaryCloudName    || null,
      cloudinaryUploadPreset:  s.cloudinaryUploadPreset || null,
      cloudinaryApiKey:        s.cloudinaryApiKey  ? decryptKey(s.cloudinaryApiKey)  : null,
    }
  } catch {
    return null
  }
}
