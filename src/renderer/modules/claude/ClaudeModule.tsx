import { memo, useCallback, useEffect, useState } from "react";
import type {
  ClaudeAccountUsage,
  ClaudeUsageLimit,
  ClaudeUsageSnapshot,
} from "../../../shared/contracts";

const REFRESH_INTERVAL_MS = 60_000;

const formatReset = (isoDate: string | null) => {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  const time = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const sameDay = date.toDateString() === new Date().toDateString();
  if (sameDay) return `reseta ${time}`;
  const day = date.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
  return `reseta ${day} ${time}`;
};

const SHORT_LABELS: Partial<Record<ClaudeUsageLimit["kind"], string>> = {
  session: "5h",
  weekly_all: "7d",
};

const formatResetTime = (isoDate: string | null) => {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

function LimitRow({ limit }: { limit: ClaudeUsageLimit }) {
  const tone = limit.percent >= 80 ? "warn" : "accent";
  const reset = formatReset(limit.resetsAt);
  const shortLabel = SHORT_LABELS[limit.kind] ?? limit.label;
  const sessionReset =
    limit.kind === "session" ? formatResetTime(limit.resetsAt) : null;

  return (
    <div
      className={`claude-limit claude-limit--${tone}`}
      title={[limit.label, reset].filter(Boolean).join(" — ")}
    >
      <span>
        {sessionReset ? `${shortLabel} (${sessionReset})` : shortLabel}
      </span>
      <strong>{limit.percent}%</strong>
      <div className="claude-limit-track" aria-hidden>
        <span style={{ transform: `scaleX(${limit.percent / 100})` }} />
      </div>
    </div>
  );
}

function AccountSection({ usage }: { usage: ClaudeAccountUsage }) {
  return (
    <li className="claude-account">
      <div className="claude-account-name">
        <strong>{usage.account}</strong>
        {usage.subscriptionType && <small>{usage.subscriptionType}</small>}
      </div>
      {usage.error ? (
        <span className="claude-account-error">{usage.error}</span>
      ) : (
        <div className="claude-limit-grid">
          {usage.limits.map((limit) => (
            <LimitRow key={`${limit.kind}-${limit.label}`} limit={limit} />
          ))}
        </div>
      )}
    </li>
  );
}

export const ClaudeModule = memo(function ClaudeModule() {
  const [snapshot, setSnapshot] = useState<ClaudeUsageSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadUsage = useCallback(async () => {
    try {
      setSnapshot(await window.electronControl.claude.getUsage());
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nao foi possivel ler o uso do Claude.",
      );
    }
  }, []);

  useEffect(() => {
    void loadUsage();
    const timer = window.setInterval(
      () => void loadUsage(),
      REFRESH_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [loadUsage]);

  const accounts = snapshot?.accounts ?? [];

  return (
    <div className="module-content claude-module">
      <div className="module-heading">
        <div>
          <span className="eyebrow">CLAUDE CODE</span>
          <h2>Uso</h2>
        </div>
        <div className="module-actions">
          <button
            className="module-action-icon weather-refresh-button"
            aria-label="Atualizar uso do Claude"
            title="Atualizar"
            onClick={() => void loadUsage()}
          />
        </div>
      </div>

      <div className="module-body claude-body">
        {error && !snapshot && (
          <div className="system-empty">
            <strong>Uso indisponivel</strong>
            <span>{error}</span>
          </div>
        )}

        {snapshot && accounts.length === 0 && (
          <div className="system-empty">
            <strong>Nenhuma conta</strong>
            <span>Nenhuma pasta ~/.claude* com login encontrada.</span>
          </div>
        )}

        {accounts.length > 0 && (
          <ul className="claude-account-list">
            {accounts.map((usage) => (
              <AccountSection key={usage.account} usage={usage} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
});
