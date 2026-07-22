// supabase-js's FunctionsHttpError.message is always the generic "Edge
// Function returned a non-2xx status code" — the actual reason lives in the
// response body (context), which every edge function here returns as
// {error: "..."}. This unwraps it so callers get the real message instead.
export async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.json();
      if (body?.error) return String(body.error);
    } catch {
      /* response wasn't JSON */
    }
  }
  return (error as { message?: string } | null)?.message ?? fallback;
}
