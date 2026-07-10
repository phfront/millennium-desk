import { useEffect, useState } from "react";

/**
 * Moedas fiat com par X-BRL na AwesomeAPI. Para elas o icone e a bandeira
 * do pais (flagcdn); as 2 primeiras letras do codigo ISO 4217 sao o pais,
 * exceto EUR. Codigos fora da lista sao tratados como cripto.
 */
const FIAT_CODES = new Set([
  "AED",
  "ARS",
  "AUD",
  "BOB",
  "BRL",
  "CAD",
  "CHF",
  "CLP",
  "CNY",
  "COP",
  "CRC",
  "CZK",
  "DKK",
  "EGP",
  "EUR",
  "GBP",
  "HKD",
  "HUF",
  "ILS",
  "INR",
  "JPY",
  "KES",
  "KRW",
  "MXN",
  "NOK",
  "NZD",
  "PEN",
  "PHP",
  "PLN",
  "PYG",
  "RON",
  "RSD",
  "RUB",
  "SAR",
  "SEK",
  "SGD",
  "THB",
  "TRY",
  "TWD",
  "USD",
  "UYU",
  "VEF",
  "ZAR",
]);

const CRYPTO_ICONS_BASE =
  "https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@0.18.1/svg/color/";

const iconUrl = (code: string): string =>
  FIAT_CODES.has(code)
    ? `https://flagcdn.com/${code === "EUR" ? "eu" : code.slice(0, 2).toLowerCase()}.svg`
    : `${CRYPTO_ICONS_BASE}${code.toLowerCase()}.svg`;

/** Icone redondo do ativo; sem icone no CDN, vira selo com as iniciais. */
export function QuoteAssetIcon({ code }: { code: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [code]);

  if (failed) {
    return (
      <span className="quote-icon quote-icon--fallback" aria-hidden>
        {code.slice(0, 2)}
      </span>
    );
  }
  return (
    <img
      className="quote-icon"
      src={iconUrl(code)}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
