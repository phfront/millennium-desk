import { useCallback, useEffect, useMemo, useState } from "react";
import type { LogCategory, LogEntry } from "../../shared/contracts";
import { LOG_CATEGORIES, LOG_CATEGORY_LABELS } from "../../shared/contracts";

const formatTimestamp = (iso: string) => {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const time = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });

  if (sameDay) return time;

  return `${date.toLocaleDateString("pt-BR")} ${time}`;
};

const formatData = (data: unknown) => {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
};

const matchesFilters = (
  entry: LogEntry,
  categories: Set<LogCategory>,
  search: string,
) => {
  if (!categories.has(entry.category)) return false;

  const term = search.trim().toLowerCase();
  if (!term) return true;

  return [
    entry.message,
    entry.category,
    entry.data !== undefined ? JSON.stringify(entry.data) : "",
  ]
    .join(" ")
    .toLowerCase()
    .includes(term);
};

const toggleSetValue = <T,>(current: Set<T>, value: T) => {
  const next = new Set(current);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
};

export function LogsPanel({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [search, setSearch] = useState("");
  const [categories, setCategories] = useState<Set<LogCategory>>(
    () => new Set(LOG_CATEGORIES),
  );
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());
  const [copyState, setCopyState] = useState<"idle" | "done" | "error">("idle");

  useEffect(() => {
    let active = true;

    void window.electronControl.logs.query().then((initial) => {
      if (active) setEntries(initial);
    });

    const unsubscribe = window.electronControl.logs.onEntry((entry) => {
      setEntries((current) => [entry, ...current].slice(0, 500));
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const filtered = useMemo(
    () =>
      entries.filter((entry) => matchesFilters(entry, categories, search)),
    [entries, categories, search],
  );

  const resetFilters = () => {
    setSearch("");
    setCategories(new Set(LOG_CATEGORIES));
  };

  const toggleExpanded = (id: number) => {
    setExpandedIds((current) => toggleSetValue(current, id));
  };

  const copyVisible = useCallback(async () => {
    const payload = filtered
      .map((entry) => {
        const base = `[${entry.timestamp}] ${entry.category} — ${entry.message}`;
        if (entry.data === undefined) return base;
        return `${base}\n${formatData(entry.data)}`;
      })
      .join("\n\n");

    try {
      await navigator.clipboard.writeText(payload);
      setCopyState("done");
      window.setTimeout(() => setCopyState("idle"), 1_500);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 1_500);
    }
  }, [filtered]);

  const clearLogs = async () => {
    await window.electronControl.logs.clear();
    setEntries([]);
    setExpandedIds(new Set());
  };

  const filtersActive =
    search.trim().length > 0 || categories.size !== LOG_CATEGORIES.length;

  return (
    <>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">DIAGNOSTICO</span>
          <h2>Erros</h2>
        </div>
        <button className="icon-button" onClick={onClose}>
          Fechar
        </button>
      </div>

      <p className="logs-intro muted">
        Apenas falhas e problemas reais — monitor desconectado, crash, excecoes
        nao tratadas.
      </p>

      <div className="logs-toolbar">
        <label className="logs-search">
          <span>Buscar</span>
          <input
            type="search"
            placeholder="Mensagem ou detalhes..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <div className="logs-filter-group">
          <span>Categoria</span>
          <div className="logs-chips">
            {LOG_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                className={`logs-chip logs-chip--category${categories.has(category) ? " active" : ""}`}
                onClick={() =>
                  setCategories((current) => toggleSetValue(current, category))
                }
              >
                {LOG_CATEGORY_LABELS[category]}
              </button>
            ))}
          </div>
        </div>

        <div className="logs-toolbar-actions">
          <span className="logs-count">
            {filtered.length} de {entries.length} erros
          </span>
          {filtersActive && (
            <button type="button" className="button" onClick={resetFilters}>
              Limpar filtros
            </button>
          )}
          <button type="button" className="button" onClick={() => void copyVisible()}>
            {copyState === "done"
              ? "Copiado"
              : copyState === "error"
                ? "Falhou"
                : "Copiar"}
          </button>
          <button
            type="button"
            className="button"
            onClick={() => void clearLogs()}
          >
            Limpar
          </button>
        </div>
      </div>

      <div className="logs-stream" role="log" aria-live="polite">
        {filtered.length === 0 ? (
          <p className="logs-empty muted">
            {entries.length === 0
              ? "Nenhum erro registrado."
              : "Nenhum erro corresponde aos filtros."}
          </p>
        ) : (
          filtered.map((entry) => {
            const expanded = expandedIds.has(entry.id);
            const hasData = entry.data !== undefined;

            return (
              <article key={entry.id} className="log-entry log-entry--error">
                <div className="log-entry-main">
                  <time dateTime={entry.timestamp}>{formatTimestamp(entry.timestamp)}</time>
                  <span className="log-category">
                    {LOG_CATEGORY_LABELS[entry.category]}
                  </span>
                  <p className="log-message">{entry.message}</p>
                  {hasData && (
                    <button
                      type="button"
                      className="log-expand"
                      aria-expanded={expanded}
                      onClick={() => toggleExpanded(entry.id)}
                    >
                      {expanded ? "Ocultar detalhes" : "Ver detalhes"}
                    </button>
                  )}
                </div>
                {hasData && expanded && (
                  <pre className="log-data">{formatData(entry.data)}</pre>
                )}
              </article>
            );
          })
        )}
      </div>
    </>
  );
}
