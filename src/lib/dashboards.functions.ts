import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const fileSchema = z.object({
  name: z.string(),
  mimeType: z.string(),
  base64: z.string(),
});

const inputSchema = z.object({
  prompt: z.string().min(1).max(4000),
  files: z.array(fileSchema).max(6).optional(),
});

const SCHEMA_DOC = `
Available internal datasets and the fields you can group by / sum:
- expenses: groupBy any of [category, status, vendor, currency]; sum field: amount (money, INR)
- candidates: groupBy any of [stage, source]; count only
- job_requests: groupBy any of [status, department, employment_type]; sum field: openings
- calendar_events: groupBy [event_type]; count only

Return ONLY valid JSON matching this TypeScript type (no markdown, no prose):
{
  "title": string,
  "description": string,
  "widgets": Array<{
    "type": "stat" | "bar" | "pie" | "line",
    "title": string,
    "source": "dataset" | "inline",
    // when source = "dataset":
    "dataset"?: "expenses" | "candidates" | "job_requests" | "calendar_events",
    "metric"?: "count" | "sum",
    "valueField"?: string,      // required when metric = "sum" (e.g. "amount", "openings")
    "groupBy"?: string,         // required for bar/pie/line
    // when source = "inline" (use for data extracted from uploaded files):
    "data"?: Array<{ "name": string, "value": number }>,
    "format"?: "money" | "number",
    "span"?: 1 | 2              // 2 = full width, use for bar/line charts
  }>
}
Rules: 5-7 widgets. Start with 1-2 "stat" widgets. Use "money" format only for expense amount metrics.
For any uploaded file data, extract the relevant numbers and produce "inline" widgets with a "data" array.`;

function accentPrompt(userPrompt: string) {
  return `You are an HR analytics dashboard designer for Tericsoft Technology Solutions.
Design a dashboard based on this request:
"""${userPrompt}"""

${SCHEMA_DOC}`;
}

const ALLOWED_TYPES = new Set(["stat", "bar", "pie", "line"]);
const ALLOWED_DATASETS = new Set(["expenses", "candidates", "job_requests", "calendar_events"]);

function normalize(raw: unknown): { title: string; description: string; widgets: unknown[] } {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const widgetsIn = Array.isArray(obj.widgets) ? obj.widgets : [];
  const widgets = widgetsIn
    .map((w, i) => {
      const x = (w ?? {}) as Record<string, unknown>;
      const type = String(x.type ?? "bar");
      if (!ALLOWED_TYPES.has(type)) return null;
      const source = x.source === "inline" || Array.isArray(x.data) ? "inline" : "dataset";
      const base: Record<string, unknown> = {
        id: `w${i}`,
        type,
        title: String(x.title ?? "Untitled"),
        source,
        format: x.format === "money" ? "money" : "number",
        span: x.span === 2 ? 2 : 1,
      };
      if (source === "inline") {
        base.data = (Array.isArray(x.data) ? x.data : [])
          .map((d) => {
            const dd = (d ?? {}) as Record<string, unknown>;
            return { name: String(dd.name ?? "—"), value: Number(dd.value) || 0 };
          })
          .slice(0, 20);
      } else {
        const dataset = String(x.dataset ?? "");
        if (!ALLOWED_DATASETS.has(dataset)) return null;
        base.dataset = dataset;
        base.metric = x.metric === "sum" ? "sum" : "count";
        if (base.metric === "sum") base.valueField = String(x.valueField ?? "amount");
        if (type !== "stat") base.groupBy = String(x.groupBy ?? "");
      }
      return base;
    })
    .filter(Boolean)
    .slice(0, 8);
  return {
    title: String(obj.title ?? "Custom dashboard"),
    description: String(obj.description ?? ""),
    widgets,
  };
}

export const generateDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("Gemini API key is not configured.");

    const parts: unknown[] = [{ text: accentPrompt(data.prompt) }];
    for (const f of data.files ?? []) {
      parts.push({ inlineData: { mimeType: f.mimeType || "text/plain", data: f.base64 } });
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      console.error(`Gemini error [${res.status}]: ${body}`);
      throw new Error(`Dashboard generation failed (${res.status}). Please try again.`);
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("The AI returned an unexpected response. Please rephrase and try again.");
      parsed = JSON.parse(m[0]);
    }
    return normalize(parsed);
  });
