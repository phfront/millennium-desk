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
  const primary = displayCurrencies[0] ?? "BRL";
  const secondary = displayCurrencies[1] ?? null;

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
