export interface ScanResult {
  vendor: string | null;
  amount: number | null;
  date: string | null;
  category: string | null;
  title: string | null;
}

export async function scanReceipt(file: {
  name: string;
  mimeType: string;
  base64: string;
}): Promise<ScanResult> {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key)
    throw new Error(
      "Gemini API key is not configured. Add VITE_GEMINI_API_KEY to your .env file.",
    );

  const prompt = `You are an expense receipt analyzer. Extract the following fields from this receipt image:
- vendor (the merchant or business name)
- amount (the total amount paid, as a plain number, no currency symbol, no commas)
- date (the receipt date in YYYY-MM-DD format)
- category (one of: travel, meals, software, hardware, office, recruiting, training, other)
- title (a short 2-5 word description of what was purchased)

Return ONLY valid JSON with these fields, no markdown, no prose, no explanation. Example:
{"vendor": "Uber", "amount": 450, "date": "2026-07-10", "category": "travel", "title": "Cab to client meeting"}

If you cannot determine a field, use null for that field. Do not make up values.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { mimeType: file.mimeType, data: file.base64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0.2 },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    console.error(`Gemini receipt scan error [${res.status}]: ${body}`);
    throw new Error(`Receipt scan failed (${res.status}). Please try again.`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text =
    json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
    "";

  let result: ScanResult;
  try {
    result = JSON.parse(text) as ScanResult;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Could not read the receipt. Please try a clearer image.");
    result = JSON.parse(m[0]) as ScanResult;
  }

  return result;
}
