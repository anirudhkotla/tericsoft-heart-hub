// Client for the gemini-proxy edge function — replaces direct
// fetch(...&key=VITE_GEMINI_API_KEY) calls, which would otherwise bake a
// real Gemini API key into the public JS bundle (Vite embeds every
// VITE_-prefixed var verbatim). The key now lives only as a Supabase
// function secret.
import { supabase } from "@/integrations/supabase/client";
import { functionErrorMessage } from "@/lib/edge-function-error";

export interface GeminiCandidate {
  content?: { parts?: { text?: string }[] };
}

export interface GeminiGenerateContentResponse {
  candidates?: GeminiCandidate[];
}

export async function callGemini(params: {
  contents: unknown;
  generationConfig?: unknown;
  systemInstruction?: unknown;
  model?: string;
}): Promise<GeminiGenerateContentResponse> {
  const { data, error } = await supabase.functions.invoke("gemini-proxy", { body: params });
  if (error) throw new Error(await functionErrorMessage(error, "Gemini request failed"));
  if (data?.error) throw new Error(data.error);
  return data as GeminiGenerateContentResponse;
}

export function geminiText(response: GeminiGenerateContentResponse): string {
  return response.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
}
