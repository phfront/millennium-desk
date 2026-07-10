import { memo, useCallback, useEffect, useState } from "react";
import type { QuoteItem, QuotesSnapshot } from "../../../shared/contracts";
import { QuoteAssetIcon } from "./QuoteAssetIcon";

const REFRESH_INTERVAL_MS = 5 * 60_000;

const formatValue = (value: number, currency: string) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency,
    minimumFractionDigits: value >= 1000 ? 0 : 2,
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  });

const formatPct = (pctChange: number) =>
  `${pctChange > 0 ? "+" : ""}${pctChange.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;

function QuoteRow({ quote }: { quote: QuoteItem }) {
  const trend =
    quote.pctChange > 0 ? "up" : quote.pctChange < 0 ? "down" : "flat";
  const [primary, secondary] = quote.values;

  return (
    <li className="quote-row" title={quote.label}>
      <QuoteAssetIcon code={quote.code} />
      <div className="quote-code">
        <strong>{quote.code}</strong>
        <small>{quote.label}</small>
      </div>
      <div className="quote-value">
        {secondary && (
          <small className="quote-secondary">
            {formatValue(secondary.value, secondary.currency)}
          </small>
        )}
        <strong>{formatValue(primary.value, primary.currency)}</strong>
        <small className={`quote-change quote-change--${trend}`}>
          {formatPct(quote.pctChange)}
        </small>
      </div>
    </li>
  );
}

export const QuotesModule = memo(function QuotesModule({
  assets,
  displayCurrencies,
}: {
  assets: string[];
  displayCurrencies: string[];
}) {
  const [snapshot, setSnapshot] = useState<QuotesSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadQuotes = useCallback(async () => {
    try {
      setSnapshot(
        await window.electronControl.quotes.get(assets, displayCurrencies),
      );
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nao foi possivel ler as cotacoes.",
      );
    }
  }, [assets, displayCurrencies]);

  useEffect(() => {
    void loadQuotes();
    const timer = window.setInterval(
      () => void loadQuotes(),
      REFRESH_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [loadQuotes]);

  return (
    <div className="module-content quotes-module">
      <div className="module-heading">
        <div>
          <span className="eyebrow">MERCADO</span>
          <h2>Cotacoes</h2>
        </div>
        <div className="module-actions">
          <button
            className="module-action-icon weather-refresh-button"
            aria-label="Atualizar cotacoes"
            title="Atualizar"
            onClick={() => void loadQuotes()}
          />
        </div>
      </div>

      <div className="module-body quotes-body">
        {error && !snapshot && (
          <div className="system-empty">
            <strong>Cotacoes indisponiveis</strong>
            <span>{error}</span>
          </div>
        )}

        {snapshot && (
          <ul className="quote-list">
            {snapshot.quotes.map((quote) => (
              <QuoteRow key={quote.code} quote={quote} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
});
