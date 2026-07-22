// Server-side Gemini call for the agent loop. Unlike the browser call sites
// (src/lib/dashboards.functions.ts etc.), the API key here is a Supabase
// function secret (GEMINI_API_KEY) — never shipped to the client.
export type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

export interface GeminiContent {
  role: "user" | "model" | "function";
  parts: GeminiPart[];
}

export interface GeminiFunctionDeclaration {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface GenerateContentResult {
  content: GeminiContent | null;
  finishReason?: string;
}

export async function generateContent(
  model: string,
  contents: GeminiContent[],
  systemInstruction: string,
  functionDeclarations: GeminiFunctionDeclaration[],
  generationConfig?: Record<string, unknown>,
): Promise<GenerateContentResult> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("GEMINI_API_KEY is not configured for this Supabase project.");

  const body: Record<string, unknown> = {
    contents,
    systemInstruction: { parts: [{ text: systemInstruction }] },
    generationConfig,
  };
  if (functionDeclarations.length > 0) {
    body.tools = [{ functionDeclarations }];
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini error [${res.status}]: ${text.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: GeminiContent; finishReason?: string }[];
  };
  const candidate = json.candidates?.[0];
  return { content: candidate?.content ?? null, finishReason: candidate?.finishReason };
}
