import { useState } from "react";
import { useSnackbar } from "../../components/Snackbar";
import { shortcutTileStyle } from "./shortcutColors";
import type {
  ShortcutGridSettings,
  ShortcutItem,
} from "../../../shared/contracts";

const TYPE_SYMBOLS: Record<ShortcutItem["type"], string> = {
  app: "APP",
  file: "FILE",
  url: "WEB",
  batch: "BAT",
  powershell: "PS",
};

export function ShortcutsModule({
  shortcuts,
  gridSettings,
  onConfigure,
}: {
  shortcuts: ShortcutItem[];
  gridSettings: ShortcutGridSettings;
  onConfigure: () => void;
}) {
  const { showSnackbar } = useSnackbar();
  const [runningId, setRunningId] = useState<number | null>(null);

  const run = async (shortcut: ShortcutItem) => {
    if (
      shortcut.confirmBeforeRun &&
      !window.confirm(`Executar "${shortcut.name}"?`)
    ) {
      return;
    }
    setRunningId(shortcut.id);
    try {
      await window.electronControl.shortcuts.execute(shortcut.id);
    } catch (error) {
      showSnackbar(
        error instanceof Error ? error.message : "Falha ao executar.",
      );
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div className="module-content shortcuts-module">
      <div className="module-heading">
        <div>
          <span className="eyebrow">ACOES RAPIDAS</span>
          <h2>Atalhos</h2>
        </div>
        <div className="module-actions">
          <button
            className="module-action-icon module-config-button"
            aria-label="Configurar atalhos"
            onClick={onConfigure}
          />
        </div>
      </div>
      <div className="module-body shortcuts-body">
        {shortcuts.length === 0 ? (
          <button className="shortcuts-empty" onClick={onConfigure}>
            <strong>Adicionar primeiro atalho</strong>
            <span>Abra apps, URLs, arquivos, BAT ou PowerShell.</span>
          </button>
        ) : (
          <div
            className="shortcuts-grid"
            style={{
              "--shortcut-columns": gridSettings.columns,
              "--shortcut-rows": gridSettings.rows,
            } as React.CSSProperties}
          >
            {shortcuts.map((shortcut) => (
              <button
                key={shortcut.id}
                type="button"
                className="shortcut-tile"
                disabled={runningId === shortcut.id}
                data-grid-slot={shortcut.gridSlot}
                style={{
                  gridColumn: (shortcut.gridSlot % gridSettings.columns) + 1,
                  gridRow: Math.floor(shortcut.gridSlot / gridSettings.columns) + 1,
                }}
                onClick={() => void run(shortcut)}
              >
                <span
                  className="shortcut-tile-bg"
                  aria-hidden="true"
                  style={shortcutTileStyle(shortcut.color, shortcut.color2)}
                />
                {shortcut.iconDataUrl ? (
                  <img
                    className="shortcut-image"
                    src={shortcut.iconDataUrl}
                    alt=""
                  />
                ) : (
                  <span className="shortcut-symbol">
                    {TYPE_SYMBOLS[shortcut.type]}
                  </span>
                )}
                {!(shortcut.imageOnly && shortcut.iconDataUrl) && (
                  <span className="shortcut-tile-label">
                    <strong>{shortcut.name}</strong>
                    <small>
                      {runningId === shortcut.id ? "Abrindo..." : shortcut.type}
                    </small>
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
