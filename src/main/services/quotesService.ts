import type {
  QuoteAssetOption,
  QuoteItem,
  QuotesSnapshot,
} from "../../shared/contracts";
import {
  DEFAULT_QUOTE_ASSETS,
  DEFAULT_QUOTE_DISPLAY_CURRENCIES,
  getQuoteAssetLabel,
  isQuoteAssetCode,
  isQuoteDisplayCurrency,
} from "../../shared/quotes";

const QUOTES_BASE_URL = "https://economia.awesomeapi.com.br/json/last/";
const AVAILABLE_URL = "https://economia.awesomeapi.com.br/json/available";
const CACHE_TTL_MS = 5 * 60_000;
const ERROR_RETRY_MS = 60_000;
const AVAILABLE_TTL_MS = 24 * 60 * 60_000;

interface RateEntry {
  bid: number;
  pctChange: number;
  updatedAt: string;
  name: string | null;
}

const cache = new Map<
  string,
  { nextFetchAt: number; snapshot: QuotesSnapshot }
>();

let availableCache: {
  fetchedAt: number;
  assets: QuoteAssetOption[];
} | null = null;

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const loadAvailableAssets = async (): Promise<QuoteAssetOption[]> => {
  if (
    availableCache &&
    Date.now() - availableCache.fetchedAt < AVAILABLE_TTL_MS
  ) {
    return availableCache.assets;
  }
  const response = await fetch(AVAILABLE_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(
      `Servico de cotacoes indisponivel (${response.status}).`,
    );
  }
  const payload = (await response.json()) as Record<string, string>;
  const seen = new Set<string>();
  const assets: QuoteAssetOption[] = [];
  for (const [pair, name] of Object.entries(payload)) {
    // So pares X-BRL servem: o cambio cruzado do modulo parte deles.
    if (!pair.endsWith("-BRL")) continue;
    const code = pair.slice(0, -4);
    if (!isQuoteAssetCode(code) || seen.has(code)) continue;
    seen.add(code);
    assets.push({ code, label: name.split("/")[0] ?? code });
  }
  availableCache = { fetchedAt: Date.now(), assets };
  return assets;
};

export const searchQuoteAssets = async (
  query: string,
): Promise<QuoteAssetOption[]> => {
  const normalizedQuery = normalizeText(query.trim());
  if (normalizedQuery.length < 2) return [];
  const assets = await loadAvailableAssets();
  return assets
    .filter(
      (asset) =>
        normalizeText(asset.code).includes(normalizedQuery) ||
        normalizeText(asset.label).includes(normalizedQuery),
    )
    .slice(0, 30);
};

const parseRates = (payload: unknown): Map<string, RateEntry> => {
  const rates = new Map<string, RateEntry>();
  if (!payload || typeof payload !== "object") return rates;
  for (const raw of Object.values(payload as Record<string, unknown>)) {
    const quote = raw as {
      code?: string;
      bid?: string;
      pctChange?: string;
      create_date?: string;
      name?: string;
    };
    const bid = Number(quote.bid);
    if (!quote.code || !Number.isFinite(bid) || bid <= 0) continue;
    const pctChange = Number(quote.pctChange);
    rates.set(quote.code, {
      bid,
      pctChange: Number.isFinite(pctChange) ? pctChange : 0,
      updatedAt: quote.create_date ?? "",
      name: quote.name?.split("/")[0] ?? null,
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
        label: rate.name ?? getQuoteAssetLabel(asset),
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
