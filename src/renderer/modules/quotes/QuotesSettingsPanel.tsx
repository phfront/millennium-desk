import { useEffect, useState } from "react";
import type { QuoteAssetOption } from "../../../shared/contracts";
import { QuoteAssetIcon } from "./QuoteAssetIcon";
import {
  QUOTE_ASSETS,
  QUOTE_DISPLAY_CURRENCIES,
  getQuoteAssetLabel,
} from "../../../shared/quotes";

const CURRENCY_LABELS: Record<string, string> = {
  BRL: "Real (R$)",
  USD: "Dolar (US$)",
  EUR: "Euro (€)",
};

export function QuotesSettingsPanel({
  assets,
  displayCurrencies,
  onChange,
}: {
  assets: string[];
  displayCurrencies: string[];
  onChange: (value: {
    assets?: string[];
    displayCurrencies?: string[];
  }) => void;
}) {
  const primary = displayCurrencies[0] ?? "BRL";
  const secondary = displayCurrencies[1] ?? null;
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<QuoteAssetOption[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      setResults([]);
      setSearchError(null);
      return;
    }
    const timer = window.setTimeout(() => {
      window.electronControl.quotes
        .searchAssets(query)
        .then((found) => {
          setResults(found);
          setSearchError(null);
        })
        .catch(() => {
          setResults([]);
          setSearchError("Falha ao buscar moedas.");
        });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const toggleAsset = (code: string) => {
    const next = assets.includes(code)
      ? assets.filter((asset) => asset !== code)
      : [...assets, code];
    if (next.length === 0) return;
    onChange({ assets: next });
  };

  const choosePrimary = (currency: string) => {
    if (currency === primary) return;
    // Escolher a atual secundaria como principal inverte as duas.
    const nextSecondary = currency === secondary ? primary : secondary;
    onChange({
      displayCurrencies: nextSecondary
        ? [currency, nextSecondary]
        : [currency],
    });
  };

  const chooseSecondary = (currency: string | null) => {
    onChange({
      displayCurrencies: currency ? [primary, currency] : [primary],
    });
  };

  return (
    <>
      <section className="setting-group">
        <h3>Moeda principal</h3>
        <div className="segmented">
          {QUOTE_DISPLAY_CURRENCIES.map((currency) => (
            <button
              key={currency}
              className={primary === currency ? "selected" : ""}
              onClick={() => choosePrimary(currency)}
            >
              {CURRENCY_LABELS[currency] ?? currency}
            </button>
          ))}
        </div>
      </section>

      <section className="setting-group">
        <h3>Moeda secundaria</h3>
        <p className="muted">Aparece menor, acima do valor principal.</p>
        <div className="segmented">
          <button
            className={secondary === null ? "selected" : ""}
            onClick={() => chooseSecondary(null)}
          >
            Nenhuma
          </button>
          {QUOTE_DISPLAY_CURRENCIES.filter(
            (currency) => currency !== primary,
          ).map((currency) => (
            <button
              key={currency}
              className={secondary === currency ? "selected" : ""}
              onClick={() => chooseSecondary(currency)}
            >
              {CURRENCY_LABELS[currency] ?? currency}
            </button>
          ))}
        </div>
      </section>

      <section className="setting-group">
        <h3>Ativos</h3>
        <input
          type="search"
          className="quotes-asset-search"
          placeholder="Buscar moeda ou cripto (ex.: peso, solana, MXN)..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {searchError && <p className="muted">{searchError}</p>}
        {search.trim().length >= 2 && !searchError && results.length === 0 && (
          <p className="muted">Nada encontrado para "{search.trim()}".</p>
        )}
        <div className="quotes-asset-grid">
          {(search.trim().length >= 2
            ? results
            : [
                ...QUOTE_ASSETS,
                // Selecionados fora do catalogo padrao continuam visiveis
                ...assets
                  .filter(
                    (code) =>
                      !QUOTE_ASSETS.some((asset) => asset.code === code),
                  )
                  .map((code) => ({ code, label: getQuoteAssetLabel(code) })),
              ]
          ).map((asset) => {
            const active = assets.includes(asset.code);
            return (
              <button
                key={asset.code}
                type="button"
                className={
                  active ? "quotes-asset-toggle selected" : "quotes-asset-toggle"
                }
                onClick={() => toggleAsset(asset.code)}
              >
                <QuoteAssetIcon code={asset.code} />
                <span className="quotes-asset-toggle-text">
                  <strong>{asset.code}</strong>
                  <span>{asset.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}
