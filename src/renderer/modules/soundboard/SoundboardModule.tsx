import { memo, useSyncExternalStore } from "react";
import { useSnackbar } from "../../components/Snackbar";
import { shortcutTileStyle } from "../shortcuts/shortcutColors";
import {
  getPlayingSnapshot,
  stopAllSounds,
  subscribePlaying,
  toggleSound,
} from "./soundPlayer";
import type {
  SoundboardSettings,
  SoundItem,
} from "../../../shared/contracts";

export const SoundboardModule = memo(function SoundboardModule({
  sounds,
  settings,
  onConfigure,
  onAddAtSlot,
}: {
  sounds: SoundItem[];
  settings: SoundboardSettings;
  onConfigure: () => void;
  onAddAtSlot: (slot: number) => void;
}) {
  const { showSnackbar } = useSnackbar();
  const playing = useSyncExternalStore(subscribePlaying, getPlayingSnapshot);
  const { columns, rows } = settings.grid;
  const slotCount = columns * rows;

  const toggle = async (sound: SoundItem) => {
    try {
      await toggleSound(sound, settings);
    } catch (error) {
      showSnackbar(
        error instanceof Error ? error.message : "Falha ao tocar o som.",
      );
    }
  };

  return (
    <div className="module-content shortcuts-module soundboard-module">
      <div className="module-heading">
        <div>
          <span className="eyebrow">NO MICROFONE</span>
          <h2>Sons</h2>
        </div>
        <div className="module-actions">
          {playing.size > 0 && (
            <button
              className="module-action-icon sound-stop-button"
              aria-label="Parar todos os sons"
              title="Parar tudo"
              onClick={stopAllSounds}
            />
          )}
          <button
            className="module-action-icon module-config-button"
            aria-label="Configurar sons"
            onClick={onConfigure}
          />
        </div>
      </div>
      <div className="module-body shortcuts-body">
        <div
          className="shortcuts-grid"
          style={{
            "--shortcut-columns": columns,
            "--shortcut-rows": rows,
          } as React.CSSProperties}
        >
          {Array.from({ length: slotCount }, (_, slot) => {
            const position = {
              gridColumn: (slot % columns) + 1,
              gridRow: Math.floor(slot / columns) + 1,
            };
            const sound = sounds.find((item) => item.gridSlot === slot);
            if (!sound) {
              return (
                <button
                  key={`empty-${slot}`}
                  type="button"
                  className="shortcut-tile shortcut-tile--empty"
                  style={position}
                  aria-label={`Adicionar som no slot ${slot + 1}`}
                  title="Adicionar som"
                  onClick={() => onAddAtSlot(slot)}
                >
                  <span className="shortcut-tile-add-icon" aria-hidden="true">
                    +
                  </span>
                </button>
              );
            }

            const state = playing.get(sound.id);
            return (
              <button
                key={sound.id}
                type="button"
                className={[
                  "shortcut-tile",
                  "sound-tile",
                  state ? "sound-tile--playing" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={position}
                aria-pressed={Boolean(state)}
                onClick={() => void toggle(sound)}
              >
                <span
                  className="shortcut-tile-bg"
                  aria-hidden="true"
                  style={shortcutTileStyle(sound.color, sound.color2)}
                />
                {sound.iconDataUrl ? (
                  <img className="shortcut-image" src={sound.iconDataUrl} alt="" />
                ) : (
                  sound.emoji && (
                    <span className="sound-emoji" aria-hidden="true">
                      {sound.emoji}
                    </span>
                  )
                )}
                <span className="shortcut-tile-label">
                  <strong>{sound.name}</strong>
                  <small>{state ? "Tocando · toque para parar" : "Tocar"}</small>
                </span>
                {state?.duration && (
                  <span
                    key={state.startedAt}
                    className="sound-tile-progress"
                    aria-hidden="true"
                    style={{
                      animationDuration: `${state.duration}s`,
                      // A duracao chega depois do play: a barra comeca do ponto certo
                      animationDelay: `-${(Date.now() - state.startedAt) / 1000}s`,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
