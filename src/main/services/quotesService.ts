import type { QuoteItem, QuotesSnapshot } from "../../shared/contracts";

const QUOTES_URL =
  "https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,BTC-BRL";
const CACHE_TTL_MS = 5 * 60_000;
const ERROR_RETRY_MS = 60_000;

const QUOTE_LABELS: Record<string, string> = {
  USD: "Dolar",
  EUR: "Euro",
  BTC: "Bitcoin",
};

let cache: { nextFetchAt: number; snapshot: QuotesSnapshot } | null = null;

const parseQuotes = (payload: unknown): QuoteItem[] => {
  if (!payload || typeof payload !== "object") return [];
  const quotes: QuoteItem[] = [];
  for (const raw of Object.values(payload as Record<string, unknown>)) {
    const quote = raw as {
      code?: string;
      bid?: string;
      pctChange?: string;
      create_date?: string;
    };
    const bid = Number(quote.bid);
    const pctChange = Number(quote.pctChange);
    if (!quote.code || !Number.isFinite(bid)) continue;
    quotes.push({
      code: quote.code,
      label: QUOTE_LABELS[quote.code] ?? quote.code,
      bid,
      pctChange: Number.isFinite(pctChange) ? pctChange : 0,
      updatedAt: quote.create_date ?? "",
    });
  }
  return quotes;
};

export const getQuotes = async (): Promise<QuotesSnapshot> => {
  if (cache && Date.now() < cache.nextFetchAt) return cache.snapshot;

  try {
    const response = await fetch(QUOTES_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Servico de cotacoes indisponivel (${response.status}).`);
    }
    const quotes = parseQuotes(await response.json());
    if (quotes.length === 0) {
      throw new Error("Resposta de cotacoes vazia.");
    }
    const snapshot: QuotesSnapshot = {
      quotes,
      fetchedAt: new Date().toISOString(),
    };
    cache = { nextFetchAt: Date.now() + CACHE_TTL_MS, snapshot };
    return snapshot;
  } catch (error) {
    // Mantem o ultimo dado bom e evita martelar o servico com erro.
    if (cache) {
      cache.nextFetchAt = Date.now() + ERROR_RETRY_MS;
      return cache.snapshot;
    }
    throw error;
  }
};
