/**
 * Prausdit Research Lab — Cloudinary Integration
 *
 * Handles image upload to Cloudinary CDN.
 * Used by the agent when `generate_plan` or execution includes images.
 *
 * Flow:
 *   1. Receive Buffer or base64 image data
 *   2. Upload to Cloudinary (unsigned or signed based on config)
 *   3. Return secure CDN URL for storage/display
 *
 * Required env vars:
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_UPLOAD_PRESET   (unsigned preset, or)
 *   CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET  (signed upload)
 */

export interface CloudinaryUploadResult {
  url: string           // secure HTTPS CDN URL
  publicId: string      // cloudinary public_id
  width?: number
  height?: number
  format?: string
  bytes?: number
}

export interface CloudinaryConfig {
  cloudName: string
  uploadPreset?: string   // for unsigned uploads
  apiKey?: string         // for signed uploads
  apiSecret?: string      // for signed uploads
  folder?: string         // optional subfolder
}

function getCloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  if (!cloudName) return null
  return {
    cloudName,
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET,
    apiKey:       process.env.CLOUDINARY_API_KEY,
    apiSecret:    process.env.CLOUDINARY_API_SECRET,
    folder:       process.env.CLOUDINARY_FOLDER || "prausdit-lab",
  }
}

/**
 * Upload an image buffer to Cloudinary.
 * Tries unsigned upload first (if preset configured), falls back to signed.
 */
export async function uploadToCloudinary(
  imageData: Buffer | string,   // Buffer or base64 string
  options: {
    filename?: string
    folder?: string
    tags?: string[]
  } = {}
): Promise<CloudinaryUploadResult | null> {
  const config = getCloudinaryConfig()
  if (!config) {
    console.warn("[cloudinary] CLOUDINARY_CLOUD_NAME not set — image upload skipped")
    return null
  }

  // Convert buffer to base64 data URI if needed
  const base64 = Buffer.isBuffer(imageData)
    ? `data:image/png;base64,${imageData.toString("base64")}`
    : imageData.startsWith("data:") ? imageData : `data:image/png;base64,${imageData}`

  const folder   = options.folder   || config.folder || "prausdit-lab"
  const tags     = options.tags     || ["agent-generated"]
  const filename = options.filename || `img-${Date.now()}`

  // Try unsigned upload (simpler, no signature needed)
  if (config.uploadPreset) {
    return unsignedUpload(base64, { ...config, folder, tags, filename })
  }

  // Signed upload fallback
  if (config.apiKey && config.apiSecret) {
    return signedUpload(base64, { ...config, folder, tags, filename })
  }

  console.warn("[cloudinary] No upload preset or API key/secret configured")
  return null
}

async function unsignedUpload(
  base64: string,
  config: CloudinaryConfig & { folder: string; tags: string[]; filename: string }
): Promise<CloudinaryUploadResult | null> {
  try {
    const body = new FormData()
    body.append("file", base64)
    body.append("upload_preset", config.uploadPreset!)
    body.append("folder", config.folder)
    body.append("public_id", config.filename)
    body.append("tags", config.tags.join(","))

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
      { method: "POST", body, signal: AbortSignal.timeout(30000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    return {
      url:      data.secure_url,
      publicId: data.public_id,
      width:    data.width,
      height:   data.height,
      format:   data.format,
      bytes:    data.bytes,
    }
  } catch {
    return null
  }
}

async function signedUpload(
  base64: string,
  config: CloudinaryConfig & { folder: string; tags: string[]; filename: string }
): Promise<CloudinaryUploadResult | null> {
  try {
    // Build signature (requires crypto, available in Node 18+)
    const { createHash, createHmac } = await import("crypto")
    const timestamp = Math.floor(Date.now() / 1000)

    const paramsToSign = [
      `folder=${config.folder}`,
      `public_id=${config.filename}`,
      `tags=${config.tags.join(",")}`,
      `timestamp=${timestamp}`,
    ].sort().join("&")

    const signature = createHmac("sha1", config.apiSecret!)
      .update(paramsToSign)
      .digest("hex")

    void createHash // suppress unused warning

    const body = new FormData()
    body.append("file", base64)
    body.append("api_key", config.apiKey!)
    body.append("timestamp", String(timestamp))
    body.append("signature", signature)
    body.append("folder", config.folder)
    body.append("public_id", config.filename)
    body.append("tags", config.tags.join(","))

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`,
      { method: "POST", body, signal: AbortSignal.timeout(30000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    return {
      url:      data.secure_url,
      publicId: data.public_id,
      width:    data.width,
      height:   data.height,
      format:   data.format,
      bytes:    data.bytes,
    }
  } catch {
    return null
  }
}

/**
 * Download an image from a URL, then upload to Cloudinary.
 * Useful when an AI-generated image URL needs to be persisted.
 */
export async function downloadAndUpload(
  imageUrl: string,
  options: { filename?: string; folder?: string; tags?: string[] } = {}
): Promise<CloudinaryUploadResult | null> {
  try {
    if (!imageUrl.startsWith("https://")) return null
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) })
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    return uploadToCloudinary(buffer, options)
  } catch {
    return null
  }
}

/** Check if Cloudinary is configured */
export function isCloudinaryConfigured(): boolean {
  return !!process.env.CLOUDINARY_CLOUD_NAME && (
    !!process.env.CLOUDINARY_UPLOAD_PRESET ||
    (!!process.env.CLOUDINARY_API_KEY && !!process.env.CLOUDINARY_API_SECRET)
  )
}
