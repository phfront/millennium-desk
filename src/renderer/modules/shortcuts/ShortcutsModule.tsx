import { memo, useState } from "react";
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

export const ShortcutsModule = memo(function ShortcutsModule({
  shortcuts,
  gridSettings,
  onConfigure,
  onAddAtSlot,
}: {
  shortcuts: ShortcutItem[];
  gridSettings: ShortcutGridSettings;
  onConfigure: () => void;
  onAddAtSlot: (slot: number) => void;
}) {
  const { showSnackbar } = useSnackbar();
  const [runningId, setRunningId] = useState<number | null>(null);
  const slotCount = gridSettings.columns * gridSettings.rows;

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
        <div
          className="shortcuts-grid"
          style={{
            "--shortcut-columns": gridSettings.columns,
            "--shortcut-rows": gridSettings.rows,
          } as React.CSSProperties}
        >
          {Array.from({ length: slotCount }, (_, slot) => {
            const shortcut = shortcuts.find((item) => item.gridSlot === slot);
            if (!shortcut) {
              return (
                <button
                  key={`empty-${slot}`}
                  type="button"
                  className="shortcut-tile shortcut-tile--empty"
                  data-grid-slot={slot}
                  style={{
                    gridColumn: (slot % gridSettings.columns) + 1,
                    gridRow:
                      Math.floor(slot / gridSettings.columns) + 1,
                  }}
                  aria-label={`Adicionar atalho no slot ${slot + 1}`}
                  title="Adicionar atalho"
                  onClick={() => onAddAtSlot(slot)}
                >
                  <span className="shortcut-tile-add-icon" aria-hidden="true">
                    +
                  </span>
                </button>
              );
            }

            return (
              <button
                key={shortcut.id}
                type="button"
                className="shortcut-tile"
                disabled={runningId === shortcut.id}
                data-grid-slot={shortcut.gridSlot}
                style={{
                  gridColumn: (shortcut.gridSlot % gridSettings.columns) + 1,
                  gridRow:
                    Math.floor(shortcut.gridSlot / gridSettings.columns) + 1,
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
            );
          })}
        </div>
      </div>
    </div>
  );
});
