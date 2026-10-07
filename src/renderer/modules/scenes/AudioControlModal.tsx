import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  resolveDevices,
  voiceStatus,
  type AudioControlSettings,
  type AudioScene,
} from "../../../shared/audioControl";
import type { SoundboardSettings } from "../../../shared/contracts";
import { useSnackbar } from "../../components/Snackbar";
import { audioAlerts } from "./alerts";
import { runAudio, useAudioState } from "./audioStore";
import { AudioTab } from "./AudioTab";
import { ControlRow, ControlSection, Switch } from "./controls";
import { GridIcon, MoonIcon, SlidersIcon, SpeakerIcon, WarningIcon } from "./icons";
import { sceneMatches } from "./sceneLogic";
import { ScenesTab } from "./ScenesTab";

export type ControlTab = "scenes" | "audio" | "dnd";

const TABS: Array<{ id: ControlTab; label: string; icon: React.ReactNode }> = [
  { id: "scenes", label: "Cenas", icon: <GridIcon /> },
  { id: "audio", label: "Áudio", icon: <SpeakerIcon /> },
  { id: "dnd", label: "Não perturbe", icon: <MoonIcon size={18} /> },
];

export function AudioControlModal({
  initialTab,
  settings,
  soundboard,
  onClose,
  onSettingsChange,
  onSoundboardChange,
  onApplyScene,
  onToggleMute,
}: {
  initialTab: ControlTab;
  settings: AudioControlSettings;
  soundboard: SoundboardSettings;
  onClose: () => void;
  onSettingsChange: (next: AudioControlSettings) => Promise<void> | void;
  onSoundboardChange: (patch: Partial<SoundboardSettings>) => Promise<void>;
  onApplyScene: (scene: AudioScene) => void;
  onToggleMute: () => void;
}) {
  const state = useAudioState();
  const { showSnackbar } = useSnackbar();
  const [tab, setTab] = useState<ControlTab>(initialTab);
  const devices = resolveDevices(state, settings);
  const voice = voiceStatus(devices);
  const active = settings.scenes.find((scene) => scene.id === settings.activeSceneId);
  const activeMatches = sceneMatches(active, state, settings, soundboard);
  const alerts = audioAlerts(state, settings, active);

  useEffect(() => setTab(initialTab), [initialTab]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // Esc dentro de um campo de atalho escutando e do campo
      if ((event.target as HTMLElement | null)?.closest(".control-hotkey--listening")) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const portalRoot = document.querySelector<HTMLElement>(".app") ?? document.body;

  return createPortal(
    <div
      className="shortcut-modal-backdrop control-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="control-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="control-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="control-head">
          <span className="control-head-icon" aria-hidden="true">
            <SlidersIcon />
          </span>
          <div className="control-head-title">
            <h2 id="control-title">Controle</h2>
            <p>
              {active
                ? `Cena atual: ${active.name}${activeMatches ? "" : " (ajustada)"}`
                : "Nenhuma cena ativa"}
            </p>
          </div>
          {state.available && devices.mic && (
            <button
              type="button"
              className={["control-pill", voice.muted ? "control-pill--bad" : "control-pill--ok"].join(" ")}
              onClick={onToggleMute}
              title={voice.muted ? "Ligar minha voz" : "Mutar minha voz"}
            >
              <span className="control-pill-dot" />
              {voice.muted
                ? "Voz mutada"
                : voice.route === "cable"
                  ? "Voz + Sons na reunião"
                  : "Voz direta na reunião"}
            </button>
          )}
          {state.dnd.available && (
            <span className={["control-pill", state.dnd.on ? "control-pill--accent" : ""].join(" ")}>
              <span className="control-pill-dot" />
              {state.dnd.on ? "Não perturbe ligado" : "Avisos ligados"}
            </span>
          )}
          <button
            type="button"
            className="modal-close-button"
            aria-label="Fechar"
            title="Fechar (Esc)"
            onClick={onClose}
          />
        </header>

        {!state.available && (
          <div className="control-alerts">
            <div className="control-alert">
              <WarningIcon size={18} />
              <p>{state.error ?? "Carregando o áudio do Windows…"}</p>
            </div>
          </div>
        )}
        {alerts.length > 0 && (
          <div className="control-alerts" aria-live="polite">
            {alerts.map((alert) => (
              <div key={alert.id} className="control-alert">
                <WarningIcon size={18} />
                <p>{alert.text}</p>
                <button
                  type="button"
                  className="button active"
                  onClick={() =>
                    void runAudio(alert.fix).catch((error) =>
                      showSnackbar(error instanceof Error ? error.message : String(error)),
                    )
                  }
                >
                  {alert.action}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="control-body">
          <nav className="control-nav" role="tablist" aria-label="Seções">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>
          <div className="control-panel" role="tabpanel">
            {tab === "scenes" && (
              <ScenesTab
                state={state}
                settings={settings}
                soundboard={soundboard}
                onSettingsChange={(next) => void onSettingsChange(next)}
                onApplyScene={onApplyScene}
              />
            )}
            {tab === "audio" && (
              <AudioTab
                state={state}
                settings={settings}
                soundboard={soundboard}
                onSettingsChange={onSettingsChange}
                onSoundboardChange={onSoundboardChange}
                onToggleMute={onToggleMute}
              />
            )}
            {tab === "dnd" && (
              <ControlSection
                title="Não perturbe"
                tag="experimental"
                description="O Windows não tem jeito oficial de ligar isso por programa: o Desk usa o mesmo caminho interno do botão da Central de notificações. Uma atualização do Windows pode quebrar."
              >
                <ControlRow label="Agora">
                  <span className="control-inline">
                    <Switch
                      label="Não perturbe"
                      checked={state.dnd.on}
                      disabled={!state.dnd.available}
                      onChange={(on) =>
                        void runAudio(() => window.electronControl.audio.setDnd(on)).catch((error) =>
                          showSnackbar(error instanceof Error ? error.message : String(error)),
                        )
                      }
                    />
                    <small className="control-hint">
                      {state.dnd.available
                        ? "Cala as notificações do Windows (as prioritárias continuam)"
                        : "Este Windows não deixou o Desk mexer no Não perturbe."}
                    </small>
                  </span>
                </ControlRow>
                <ControlRow label="Nas cenas">
                  <small className="control-hint">{dndScenesText(settings.scenes)}</small>
                </ControlRow>
              </ControlSection>
            )}
          </div>
        </div>
      </section>
    </div>,
    portalRoot,
  );
}

const dndScenesText = (scenes: AudioScene[]) => {
  const on = scenes.filter((scene) => scene.changes.dnd && scene.dnd).map((scene) => scene.name);
  const off = scenes.filter((scene) => scene.changes.dnd && !scene.dnd).map((scene) => scene.name);
  const parts = [
    on.length ? `Liga em: ${on.join(", ")}.` : "",
    off.length ? `Desliga em: ${off.join(", ")}.` : "",
  ].filter(Boolean);
  return parts.join(" ") || "Nenhuma cena mexe nele.";
};
