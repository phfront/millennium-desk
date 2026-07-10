import { memo, useCallback, useEffect, useState } from "react";
import type { QuoteItem, QuotesSnapshot } from "../../../shared/contracts";

const REFRESH_INTERVAL_MS = 5 * 60_000;

const formatBid = (quote: QuoteItem) =>
  quote.bid.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: quote.bid >= 1000 ? 0 : 2,
    maximumFractionDigits: quote.bid >= 1000 ? 0 : 2,
  });

const formatPct = (pctChange: number) =>
  `${pctChange > 0 ? "+" : ""}${pctChange.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;

function QuoteRow({ quote }: { quote: QuoteItem }) {
  const trend =
    quote.pctChange > 0 ? "up" : quote.pctChange < 0 ? "down" : "flat";

  return (
    <li className="quote-row" title={quote.label}>
      <div className="quote-code">
        <strong>{quote.code}</strong>
        <small>{quote.label}</small>
      </div>
      <div className="quote-value">
        <strong>{formatBid(quote)}</strong>
        <small className={`quote-change quote-change--${trend}`}>
          {formatPct(quote.pctChange)}
        </small>
      </div>
    </li>
  );
}

export const QuotesModule = memo(function QuotesModule() {
  const [snapshot, setSnapshot] = useState<QuotesSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadQuotes = useCallback(async () => {
    try {
      setSnapshot(await window.electronControl.quotes.get());
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nao foi possivel ler as cotacoes.",
      );
    }
  }, []);

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
