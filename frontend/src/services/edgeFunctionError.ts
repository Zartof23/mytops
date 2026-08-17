/**
 * supabase-js v2 `functions.invoke` sets `error` to a `FunctionsHttpError`
 * (with `data = null`) for any non-2xx response from an Edge Function. The
 * actual `{ error: "..." }` body written by the function is not parsed for
 * you — it sits on `error.context`, which is the raw `Response`.
 *
 * This reads that body and returns its `error` message, falling back to a
 * generic message when the body can't be parsed or doesn't have one.
 */
export async function extractEdgeFunctionErrorMessage(
  error: unknown,
  fallback: string
): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context
  if (context instanceof Response) {
    try {
      const body = await context.json()
      if (body && typeof body.error === 'string') {
        return body.error
      }
    } catch {
      // Body wasn't JSON, or already consumed — fall through to fallback.
    }
  }

  return fallback
}
