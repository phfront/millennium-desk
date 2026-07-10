import {
  QUOTE_ASSETS,
  QUOTE_DISPLAY_CURRENCIES,
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
  const toggleAsset = (code: string) => {
    const next = assets.includes(code)
      ? assets.filter((asset) => asset !== code)
      : [...assets, code];
    if (next.length === 0) return;
    onChange({ assets: next });
  };

  const toggleCurrency = (currency: string) => {
    const next = displayCurrencies.includes(currency)
      ? displayCurrencies.filter((item) => item !== currency)
      : [...displayCurrencies, currency].slice(-2);
    if (next.length === 0) return;
    onChange({ displayCurrencies: next });
  };

  return (
    <>
      <section className="setting-group">
        <h3>Exibir em</h3>
        <p className="muted">
          Ate duas moedas — a segunda aparece entre parenteses.
        </p>
        <div className="segmented quotes-currency-picker">
          {QUOTE_DISPLAY_CURRENCIES.map((currency) => (
            <button
              key={currency}
              className={
                displayCurrencies.includes(currency) ? "selected" : ""
              }
              onClick={() => toggleCurrency(currency)}
            >
              {CURRENCY_LABELS[currency] ?? currency}
            </button>
          ))}
        </div>
      </section>

      <section className="setting-group">
        <h3>Ativos</h3>
        <div className="quotes-asset-grid">
          {QUOTE_ASSETS.map((asset) => {
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
                <strong>{asset.code}</strong>
                <span>{asset.label}</span>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}
