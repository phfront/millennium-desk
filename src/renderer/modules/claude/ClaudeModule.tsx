import { memo, useCallback, useEffect, useState } from "react";
import type {
  ClaudeSession,
  ClaudeSessionsSnapshot,
} from "../../../shared/contracts";

const REFRESH_INTERVAL_MS = 10_000;

const formatRelativeTime = (isoDate: string) => {
  const elapsedMs = Date.now() - Date.parse(isoDate);
  if (elapsedMs < 60_000) return "agora";
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 60) return `ha ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `ha ${hours} h`;
  return `ha ${Math.floor(hours / 24)} d`;
};

const formatTokens = (tokens: number) =>
  tokens >= 1000 ? `${Math.round(tokens / 1000)}k` : `${tokens}`;

function SessionRow({ session }: { session: ClaudeSession }) {
  const percent = session.contextPercent ?? 0;
  const tone = percent >= 80 ? "warn" : "accent";
  const tooltip = [
    session.title,
    session.projectPath,
    session.gitBranch ? `⎇ ${session.gitBranch}` : null,
    session.contextTokens !== null
      ? `${formatTokens(session.contextTokens)} tokens de contexto`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <li
      className={`claude-session claude-session--${tone}${
        session.active ? " claude-session--active" : ""
      }`}
      title={tooltip}
    >
      <div className="claude-session-top">
        <span className="claude-session-label">
          {session.active && (
            <span className="claude-session-dot" aria-label="Sessao ativa" />
          )}
          <strong>{session.account}</strong>
          <span className="claude-session-project">{session.projectName}</span>
        </span>
        <span className="claude-session-value">
          {!session.active && (
            <small>{formatRelativeTime(session.lastActivityAt)}</small>
          )}
          <strong>{percent}%</strong>
        </span>
      </div>
      <div className="claude-session-track" aria-hidden>
        <span style={{ transform: `scaleX(${percent / 100})` }} />
      </div>
    </li>
  );
}

export const ClaudeModule = memo(function ClaudeModule() {
  const [snapshot, setSnapshot] = useState<ClaudeSessionsSnapshot | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      setSnapshot(await window.electronControl.claude.listSessions());
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Nao foi possivel ler as sessoes do Claude.",
      );
    }
  }, []);

  useEffect(() => {
    void loadSessions();
    const timer = window.setInterval(
      () => void loadSessions(),
      REFRESH_INTERVAL_MS,
    );
    return () => window.clearInterval(timer);
  }, [loadSessions]);

  const sessions = snapshot?.sessions ?? [];
  const activeCount = sessions.filter((session) => session.active).length;

  return (
    <div className="module-content claude-module">
      <div className="module-heading">
        <div>
          <span className="eyebrow">CLAUDE CODE</span>
          <h2>
            Sessoes
            {activeCount > 0 && (
              <span className="claude-active-count">{activeCount}</span>
            )}
          </h2>
        </div>
        <div className="module-actions">
          <button
            className="module-action-icon weather-refresh-button"
            aria-label="Atualizar sessoes do Claude"
            title="Atualizar"
            onClick={() => void loadSessions()}
          />
        </div>
      </div>

      <div className="module-body claude-body">
        {error && !snapshot && (
          <div className="system-empty">
            <strong>Sessoes indisponiveis</strong>
            <span>{error}</span>
          </div>
        )}

        {snapshot && sessions.length === 0 && (
          <div className="system-empty">
            <strong>Nenhuma sessao</strong>
            <span>Nenhuma sessao do Claude Code nas ultimas 24 h.</span>
          </div>
        )}

        {sessions.length > 0 && (
          <ul className="claude-session-list">
            {sessions.map((session) => (
              <SessionRow
                key={`${session.account}-${session.id}`}
                session={session}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
});
