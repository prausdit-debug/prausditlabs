/**
 * lib/errors.ts — Centralised error normalisation for API responses.
 *
 * PROBLEM: Several routes return `String(err)` or `err.message` directly,
 * which can expose Prisma error details, table names, and stack traces to clients.
 *
 * RULE: In production, always return a generic message.
 *       In development, include the real message for debugging.
 */

/**
 * Returns a safe error message suitable for an API JSON response.
 * Logs the full error internally so it appears in Vercel logs.
 *
 * @param err     - The caught error
 * @param context - Short label for the log line, e.g. "api/notes POST"
 */
export function toApiError(err: unknown, context?: string): string {
  const message = err instanceof Error ? err.message : String(err)

  if (context) {
    console.error(`[${context}]`, err)
  }

  // In development, surface the real message for faster debugging
  if (process.env.NODE_ENV === "development") {
    return message
  }

  // In production, return a generic message — details only go to server logs
  return "Internal server error"
}

/**
 * Same as toApiError but also accepts a custom user-facing message
 * for cases where you want a more informative (but safe) response.
 */
export function toApiErrorWithHint(
  err: unknown,
  userMessage: string,
  context?: string
): string {
  if (context) {
    console.error(`[${context}]`, err)
  }
  return userMessage
}
