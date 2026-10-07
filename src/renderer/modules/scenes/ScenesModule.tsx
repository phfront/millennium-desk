import { memo } from "react";
import {
  SCENES_IN_CARD,
  resolveDevices,
  shortDeviceName,
  voiceStatus,
  type AudioControlSettings,
  type AudioScene,
} from "../../../shared/audioControl";
import type { SoundboardSettings } from "../../../shared/contracts";
import { shortcutTileStyle } from "../shortcuts/shortcutColors";
import { audioAlerts } from "./alerts";
import { useAudioState } from "./audioStore";
import { MicIcon, HeadphonesIcon, MoonIcon, GearIcon, WarningIcon } from "./icons";
import { sceneMatches, sceneSummary, voiceLabel } from "./sceneLogic";

/** Quadradinho de cenas: as cenas a um toque, o mute da voz e a engrenagem do Controle. */
export const ScenesModule = memo(function ScenesModule({
  settings,
  soundboard,
  onApplyScene,
  onToggleMute,
  onOpenControl,
}: {
  settings: AudioControlSettings;
  soundboard: SoundboardSettings;
  onApplyScene: (scene: AudioScene) => void;
  onToggleMute: () => void;
  onOpenControl: () => void;
}) {
  const state = useAudioState();
  const devices = resolveDevices(state, settings);
  const voice = voiceStatus(devices);
  const active = settings.scenes.find((scene) => scene.id === settings.activeSceneId);
  const activeMatches = sceneMatches(active, state, settings, soundboard);
  const alerts = audioAlerts(state, settings, active);
  const shown = settings.scenes.slice(0, SCENES_IN_CARD);
  const count = Math.max(1, shown.length);

  return (
    <div className="module-content scenes-module">
      <div className="scenes-head">
        <span className="scenes-title">Cenas</span>
        {state.available && devices.mic && (
          <button
            type="button"
            className={["scenes-icon-button", "scenes-mic", voice.muted ? "scenes-mic--muted" : ""]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={voice.muted}
            aria-label={voice.muted ? "Ligar minha voz" : "Mutar minha voz"}
            title={`${voice.muted ? "Ligar" : "Mutar"} minha voz${settings.hotkeys.mute ? ` (${settings.hotkeys.mute.replace("Control", "Ctrl")})` : ""}`}
            onClick={onToggleMute}
          >
            <MicIcon muted={voice.muted} />
          </button>
        )}
        <button
          type="button"
          className="scenes-icon-button"
          aria-label="Abrir o controle de áudio"
          title={`Controle${settings.hotkeys.open ? ` (${settings.hotkeys.open.replace("Control", "Ctrl")})` : ""}`}
          onClick={onOpenControl}
        >
          <GearIcon />
        </button>
      </div>

      {!state.available ? (
        <button type="button" className="scenes-empty" onClick={onOpenControl}>
          <strong>Controle de áudio indisponível</strong>
          <span>{state.error ?? "Carregando..."}</span>
        </button>
      ) : shown.length === 0 ? (
        <button type="button" className="scenes-empty" onClick={onOpenControl}>
          <strong>Nenhuma cena</strong>
          <span>Toque para criar a primeira.</span>
        </button>
      ) : (
        <div className={`scenes-grid scenes-grid--n${count}`}>
          {shown.map((scene) => {
            const on = scene.id === settings.activeSceneId && activeMatches;
            return (
              <button
                key={scene.id}
                type="button"
                className={["scene-tile", on ? "scene-tile--active" : ""].filter(Boolean).join(" ")}
                style={{
                  ...(on ? shortcutTileStyle(scene.color, scene.color2) : {}),
                  "--scene-c1": scene.color,
                  "--scene-c2": scene.color2,
                } as React.CSSProperties}
                aria-pressed={on}
                title={sceneSummary(scene, state)}
                onClick={() => onApplyScene(scene)}
              >
                {on && <span className="scene-tile-badge">ativa</span>}
                {scene.emoji && <span className="scene-tile-emoji" aria-hidden="true">{scene.emoji}</span>}
                <span className="scene-tile-text">
                  <strong>{scene.name}</strong>
                  <small>{sceneSummary(scene, state)}</small>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {state.available && (
        <button type="button" className="scenes-status" onClick={onOpenControl} title="Abrir o controle">
          <span className="scenes-status-item scenes-status-item--grow">
            <HeadphonesIcon />
            {shortDeviceName(devices.defaultOutput) || "sem saída"}
          </span>
          {devices.mic && (
            <span className={["scenes-status-item", voice.muted ? "scenes-status-item--bad" : ""].filter(Boolean).join(" ")}>
              <MicIcon muted={voice.muted} />
              {voice.muted ? "voz mutada" : voiceLabel(voice.route)}
            </span>
          )}
          {state.dnd.available && state.dnd.on && (
            <span className="scenes-status-item scenes-status-item--accent">
              <MoonIcon />
              silêncio
            </span>
          )}
          {alerts.length > 0 ? (
            <span className="scenes-status-item scenes-status-item--warn">
              <WarningIcon />
              ver aviso
            </span>
          ) : (
            active &&
            !activeMatches && <span className="scenes-status-item scenes-status-item--warn">ajustado</span>
          )}
        </button>
      )}
    </div>
  );
});
