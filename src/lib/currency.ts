export const CURRENCIES = [
  { id: "INR", label: "₹ INR", symbol: "₹" },
  { id: "USD", label: "$ USD", symbol: "$" },
  { id: "EUR", label: "€ EUR", symbol: "€" },
  { id: "GBP", label: "£ GBP", symbol: "£" },
  { id: "JPY", label: "¥ JPY", symbol: "¥" },
  { id: "AUD", label: "A$ AUD", symbol: "A$" },
  { id: "CAD", label: "C$ CAD", symbol: "C$" },
  { id: "SGD", label: "S$ SGD", symbol: "S$" },
  { id: "AED", label: "د.إ AED", symbol: "د.إ" },
  { id: "SAR", label: "﷼ SAR", symbol: "﷼" },
  { id: "CHF", label: "CHF", symbol: "CHF" },
  { id: "CNY", label: "¥ CNY", symbol: "¥" },
  { id: "MYR", label: "RM MYR", symbol: "RM" },
  { id: "THB", label: "฿ THB", symbol: "฿" },
  { id: "KRW", label: "₩ KRW", symbol: "₩" },
] as const;

export type CurrencyId = (typeof CURRENCIES)[number]["id"];

const rateCache = new Map<string, { rate: number; expiry: number }>();

const CACHE_TTL = 10 * 60 * 1000;

export async function fetchExchangeRate(
  from: string,
  to: string,
): Promise<number> {
  if (from === to) return 1;

  const cacheKey = `${from}_${to}`;
  const cached = rateCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    return cached.rate;
  }

  const res = await fetch(
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${from.toLowerCase()}.json`,
    { signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as Record<string, Record<string, number>>;
  const rates = json[from.toLowerCase()];
  if (!rates) throw new Error(`Rates not found for ${from}`);
  const rate = rates[to.toLowerCase()];
  if (!rate) throw new Error(`Rate not found for ${from} → ${to}`);

  rateCache.set(cacheKey, { rate, expiry: Date.now() + CACHE_TTL });
  return rate;
}
