import { useEffect, useState } from "react";
import type {
  ShelloDisplayMode,
  ShelloGridView,
  ShelloSettings,
  ShelloState,
} from "../../../shared/contracts";
import { normalizeShelloUrl } from "../../../shared/shello";

const MODES: { id: ShelloDisplayMode; label: string; hint: string }[] = [
  {
    id: "grid",
    label: "Modulo na grade",
    hint: "O Resumo (sessoes e limites) como um modulo; posicione onde quiser em Editar grid.",
  },
  {
    id: "drawer",
    label: "Gaveta lateral",
    hint: "O app completo do Shello numa gaveta, aberta pela aba na borda direita da tela.",
  },
];

const GRID_VIEWS: { id: ShelloGridView; label: string; hint: string }[] = [
  {
    id: "summary",
    label: "Resumo",
    hint: "Sessoes em cima e limites embaixo.",
  },
  {
    id: "limits",
    label: "So limites",
    hint: "So a tabela de limites dos perfis, para um modulo pequeno num canto.",
  },
];

export function ShelloSettingsPanel({
  settings,
  state,
  onChange,
  onReload,
}: {
  settings: ShelloSettings;
  state: ShelloState;
  onChange: (patch: Partial<ShelloSettings>) => void;
  onReload: () => void;
}) {
  const [urlDraft, setUrlDraft] = useState(settings.url);
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => setUrlDraft(settings.url), [settings.url]);

  const commitUrl = () => {
    const url = normalizeShelloUrl(urlDraft);
    if (!url) {
      setUrlError("Use o endereco deste PC, como http://127.0.0.1:7681.");
      return;
    }
    setUrlError(null);
    setUrlDraft(url);
    if (url !== settings.url) onChange({ url });
  };

  const status = state.offline
    ? "Fora do ar"
    : state.waiting > 0
      ? `${state.waiting} ${state.waiting === 1 ? "sessao esperando" : "sessoes esperando"} voce`
      : "Conectado";

  return (
    <>
      <section className="setting-group">
        <h3>Shello</h3>
        <p className="muted">
          Painel das sessoes do Claude Code. As visoes vem do proprio Shello; na
          primeira vez, entre com o token do .env dele.
        </p>
        <div className="segmented shello-mode-segmented">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={settings.mode === mode.id ? "selected" : ""}
              onClick={() => onChange({ mode: mode.id })}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <p className="muted">
          {MODES.find((mode) => mode.id === settings.mode)?.hint}
        </p>
        {settings.mode === "grid" && (
          <>
            <div className="segmented shello-mode-segmented">
              {GRID_VIEWS.map((view) => (
                <button
                  key={view.id}
                  type="button"
                  className={settings.gridView === view.id ? "selected" : ""}
                  onClick={() => onChange({ gridView: view.id })}
                >
                  {view.label}
                </button>
              ))}
            </div>
            <p className="muted">
              {GRID_VIEWS.find((view) => view.id === settings.gridView)?.hint}
            </p>
          </>
        )}
      </section>
      <section className="setting-group">
        <label className="shello-url-field">
          <span>Endereco</span>
          <input
            type="text"
            value={urlDraft}
            spellCheck={false}
            onChange={(event) => setUrlDraft(event.target.value)}
            onBlur={commitUrl}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitUrl();
            }}
          />
        </label>
        {urlError && <p className="shello-url-error">{urlError}</p>}
        <button type="button" className="setting-action" onClick={onReload}>
          <span>Recarregar o Shello</span>
          <strong className={state.offline ? "shello-status-off" : undefined}>
            {status}
          </strong>
        </button>
      </section>
    </>
  );
}
