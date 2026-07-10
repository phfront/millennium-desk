/** Catalogo de ativos e moedas de exibicao do modulo de cotacoes. */

export interface QuoteAssetInfo {
  code: string;
  label: string;
}

export const QUOTE_ASSETS: QuoteAssetInfo[] = [
  { code: "USD", label: "Dolar" },
  { code: "EUR", label: "Euro" },
  { code: "GBP", label: "Libra" },
  { code: "ARS", label: "Peso argentino" },
  { code: "JPY", label: "Iene" },
  { code: "CHF", label: "Franco suico" },
  { code: "CAD", label: "Dolar canadense" },
  { code: "AUD", label: "Dolar australiano" },
  { code: "CNY", label: "Yuan" },
  { code: "BTC", label: "Bitcoin" },
  { code: "ETH", label: "Ethereum" },
  { code: "XRP", label: "XRP" },
  { code: "LTC", label: "Litecoin" },
  { code: "DOGE", label: "Dogecoin" },
];

export const QUOTE_DISPLAY_CURRENCIES = ["BRL", "USD", "EUR"] as const;

export const DEFAULT_QUOTE_ASSETS = ["USD", "EUR", "BTC"];
export const DEFAULT_QUOTE_DISPLAY_CURRENCIES = ["BRL"];

/** Qualquer par X-BRL da AwesomeAPI e aceito; a busca descobre os codigos. */
export const isQuoteAssetCode = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Z0-9]{2,8}$/.test(value);

export const isQuoteDisplayCurrency = (value: unknown): value is string =>
  typeof value === "string" &&
  (QUOTE_DISPLAY_CURRENCIES as readonly string[]).includes(value);

export const getQuoteAssetLabel = (code: string): string =>
  QUOTE_ASSETS.find((asset) => asset.code === code)?.label ?? code;
