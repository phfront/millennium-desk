import type { QuoteItem, QuotesSnapshot } from "../../shared/contracts";
import {
  DEFAULT_QUOTE_ASSETS,
  DEFAULT_QUOTE_DISPLAY_CURRENCIES,
  getQuoteAssetLabel,
  isQuoteAssetCode,
  isQuoteDisplayCurrency,
} from "../../shared/quotes";

const QUOTES_BASE_URL = "https://economia.awesomeapi.com.br/json/last/";
const CACHE_TTL_MS = 5 * 60_000;
const ERROR_RETRY_MS = 60_000;

interface RateEntry {
  bid: number;
  pctChange: number;
  updatedAt: string;
}

const cache = new Map<
  string,
  { nextFetchAt: number; snapshot: QuotesSnapshot }
>();

const parseRates = (payload: unknown): Map<string, RateEntry> => {
  const rates = new Map<string, RateEntry>();
  if (!payload || typeof payload !== "object") return rates;
  for (const raw of Object.values(payload as Record<string, unknown>)) {
    const quote = raw as {
      code?: string;
      bid?: string;
      pctChange?: string;
      create_date?: string;
    };
    const bid = Number(quote.bid);
    if (!quote.code || !Number.isFinite(bid) || bid <= 0) continue;
    const pctChange = Number(quote.pctChange);
    rates.set(quote.code, {
      bid,
      pctChange: Number.isFinite(pctChange) ? pctChange : 0,
      updatedAt: quote.create_date ?? "",
    });
  }
  return rates;
};

export const getQuotes = async (
  rawAssets: string[],
  rawDisplayCurrencies: string[],
): Promise<QuotesSnapshot> => {
  const assets = (Array.isArray(rawAssets) ? rawAssets : []).filter(
    isQuoteAssetCode,
  );
  const displayCurrencies = (
    Array.isArray(rawDisplayCurrencies) ? rawDisplayCurrencies : []
  )
    .filter(isQuoteDisplayCurrency)
    .slice(0, 2);
  const effectiveAssets = assets.length > 0 ? assets : DEFAULT_QUOTE_ASSETS;
  const effectiveDisplays =
    displayCurrencies.length > 0
      ? displayCurrencies
      : DEFAULT_QUOTE_DISPLAY_CURRENCIES;

  const cacheKey = `${effectiveAssets.join(",")}|${effectiveDisplays.join(",")}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.nextFetchAt) return cached.snapshot;

  // Tudo e cotado contra BRL numa unica chamada; exibir em outra moeda
  // vira cambio cruzado (ex.: BTC em USD = BTC-BRL / USD-BRL).
  const pairCodes = [
    ...new Set([
      ...effectiveAssets,
      ...effectiveDisplays.filter((currency) => currency !== "BRL"),
    ]),
  ];

  try {
    const url = `${QUOTES_BASE_URL}${pairCodes
      .map((code) => `${code}-BRL`)
      .join(",")}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(`Servico de cotacoes indisponivel (${response.status}).`);
    }
    const rates = parseRates(await response.json());

    const quotes: QuoteItem[] = [];
    for (const asset of effectiveAssets) {
      const rate = rates.get(asset);
      if (!rate) continue;
      const currencies = effectiveDisplays.filter(
        (currency) => currency !== asset,
      );
      const values = (currencies.length > 0 ? currencies : ["BRL"]).flatMap(
        (currency) => {
          if (currency === "BRL") {
            return [{ currency, value: rate.bid }];
          }
          const currencyRate = rates.get(currency);
          return currencyRate
            ? [{ currency, value: rate.bid / currencyRate.bid }]
            : [];
        },
      );
      if (values.length === 0) continue;
      quotes.push({
        code: asset,
        label: getQuoteAssetLabel(asset),
        values,
        pctChange: rate.pctChange,
        updatedAt: rate.updatedAt,
      });
    }
    if (quotes.length === 0) {
      throw new Error("Resposta de cotacoes vazia.");
    }

    const snapshot: QuotesSnapshot = {
      quotes,
      fetchedAt: new Date().toISOString(),
    };
    cache.set(cacheKey, {
      nextFetchAt: Date.now() + CACHE_TTL_MS,
      snapshot,
    });
    return snapshot;
  } catch (error) {
    // Mantem o ultimo dado bom e evita martelar o servico com erro.
    if (cached) {
      cached.nextFetchAt = Date.now() + ERROR_RETRY_MS;
      return cached.snapshot;
    }
    throw error;
  }
};
