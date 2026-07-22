import { callGemini, geminiText } from "@/lib/gemini-proxy";

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
  const prompt = `You are an expense receipt analyzer. Extract the following fields from this receipt image:
- vendor (the merchant or business name)
- amount (the total amount paid, as a plain number, no currency symbol, no commas)
- date (the receipt date in YYYY-MM-DD format)
- category (one of: travel, meals, software, hardware, office, recruiting, training, other)
- title (a short 2-5 word description of what was purchased)

Return ONLY valid JSON with these fields, no markdown, no prose, no explanation. Example:
{"vendor": "Uber", "amount": 450, "date": "2026-07-10", "category": "travel", "title": "Cab to client meeting"}

If you cannot determine a field, use null for that field. Do not make up values.`;

  let text: string;
  try {
    const response = await callGemini({
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
    });
    text = geminiText(response);
  } catch (e) {
    console.error("Gemini receipt scan error:", e);
    throw new Error("Receipt scan failed. Please try again.");
  }

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
