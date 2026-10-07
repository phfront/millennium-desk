import { useState } from "react";
import {
  SCENES_IN_CARD,
  SCENE_PALETTE,
  findDevice,
  isVirtualCable,
  shortDeviceName,
  toDeviceRef,
  type AudioControlSettings,
  type AudioScene,
  type AudioSceneChanges,
  type AudioState,
} from "../../../shared/audioControl";
import type { SoundboardSettings } from "../../../shared/contracts";
import { shortcutTileStyle } from "../shortcuts/shortcutColors";
import { ControlSection, Segmented, VolumeSlider } from "./controls";
import { appsForScene, blankScene, captureScene } from "./sceneLogic";

const CHANGE_LABELS: Record<keyof AudioSceneChanges, string> = {
  output: "Ouvir em",
  voice: "Minha voz",
  volumes: "Volumes",
  apps: "Apps",
  dnd: "Não perturbe",
};

export function ScenesTab({
  state,
  settings,
  soundboard,
  onSettingsChange,
  onApplyScene,
}: {
  state: AudioState;
  settings: AudioControlSettings;
  soundboard: SoundboardSettings;
  onSettingsChange: (next: AudioControlSettings) => void;
  onApplyScene: (scene: AudioScene) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(
    settings.activeSceneId ?? settings.scenes[0]?.id ?? null,
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const scene =
    settings.scenes.find((item) => item.id === editingId) ?? settings.scenes[0];

  const saveScenes = (scenes: AudioScene[], extra: Partial<AudioControlSettings> = {}) =>
    onSettingsChange({ ...settings, ...extra, scenes });

  const update = (patch: Partial<AudioScene>) => {
    if (!scene) return;
    saveScenes(settings.scenes.map((item) => (item.id === scene.id ? { ...item, ...patch } : item)));
  };

  const setChange = (key: keyof AudioSceneChanges, on: boolean) =>
    scene && update({ changes: { ...scene.changes, [key]: on } });

  const add = () => {
    const created = blankScene(settings.scenes.length, state, settings, soundboard);
    saveScenes([...settings.scenes, created]);
    setEditingId(created.id);
    setConfirmDelete(false);
  };

  const remove = () => {
    if (!scene) return;
    const rest = settings.scenes.filter((item) => item.id !== scene.id);
    saveScenes(rest, {
      activeSceneId: settings.activeSceneId === scene.id ? null : settings.activeSceneId,
    });
    setEditingId(rest[0]?.id ?? null);
    setConfirmDelete(false);
  };

  const move = (delta: number) => {
    if (!scene) return;
    const index = settings.scenes.indexOf(scene);
    const target = index + delta;
    if (target < 0 || target >= settings.scenes.length) return;
    const next = [...settings.scenes];
    [next[index], next[target]] = [next[target], next[index]];
    saveScenes(next);
  };

  const outputs = state.outputs.filter((device) => !isVirtualCable(device));
  const savedOutputMissing = scene?.output && !findDevice(outputs, scene.output);
  const runningApps = appsForScene(state);
  const addableApps = runningApps.filter(
    (app) => !scene?.apps.some((item) => item.key === app.key),
  );

  return (
    <>
      <ControlSection
        title="Suas cenas"
        description={`As ${SCENES_IN_CARD} primeiras aparecem no quadradinho. Toque numa para editar.`}
      >
        <div className="control-scene-list">
          {settings.scenes.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className="control-scene-chip"
              aria-current={item.id === scene?.id}
              onClick={() => {
                setEditingId(item.id);
                setConfirmDelete(false);
              }}
            >
              <span
                className="control-scene-chip-swatch"
                style={shortcutTileStyle(item.color, item.color2)}
              >
                {item.emoji}
              </span>
              {item.name}
              {index >= SCENES_IN_CARD && <small>fora do quadradinho</small>}
            </button>
          ))}
          <button type="button" className="control-scene-chip control-scene-chip--add" onClick={add}>
            + Nova cena
          </button>
        </div>
      </ControlSection>

      {scene && (
        <ControlSection title={`Editar · ${scene.name}`}>
          <div className="control-row">
            <span className="control-row-label">Nome e emoji</span>
            <div className="control-row-value control-name-fields">
              <input
                className="control-input"
                value={scene.name}
                maxLength={40}
                aria-label="Nome da cena"
                onChange={(event) => update({ name: event.target.value })}
                onBlur={(event) => !event.target.value.trim() && update({ name: "Cena" })}
              />
              <input
                className="control-input control-input--emoji"
                value={scene.emoji}
                maxLength={16}
                aria-label="Emoji da cena"
                placeholder="🎧"
                onChange={(event) => update({ emoji: event.target.value })}
              />
            </div>
          </div>
          <div className="control-row">
            <span className="control-row-label">Cor</span>
            <div className="control-row-value control-swatches">
              {SCENE_PALETTE.map(([c1, c2]) => (
                <button
                  key={c1}
                  type="button"
                  className="control-swatch"
                  style={shortcutTileStyle(c1, c2)}
                  aria-label={`Cor ${c1}`}
                  aria-pressed={scene.color === c1 && scene.color2 === c2}
                  onClick={() => update({ color: c1, color2: c2 })}
                />
              ))}
              <label className="control-swatch control-swatch--custom" title="Cores próprias">
                <input
                  type="color"
                  value={scene.color}
                  aria-label="Cor 1"
                  onChange={(event) => update({ color: event.target.value })}
                />
                <input
                  type="color"
                  value={scene.color2}
                  aria-label="Cor 2"
                  onChange={(event) => update({ color2: event.target.value })}
                />
              </label>
            </div>
          </div>
          <div className="control-row">
            <span className="control-row-label">Ordem</span>
            <div className="control-row-value control-inline">
              <button
                type="button"
                className="button control-small-button"
                disabled={settings.scenes.indexOf(scene) === 0}
                onClick={() => move(-1)}
              >
                ← Antes
              </button>
              <button
                type="button"
                className="button control-small-button"
                disabled={settings.scenes.indexOf(scene) === settings.scenes.length - 1}
                onClick={() => move(1)}
              >
                Depois →
              </button>
            </div>
          </div>

          <div className="control-section-head control-section-head--sub">
            <h3>O que esta cena muda</h3>
            <p>O que ficar desmarcado continua como está quando você troca para ela.</p>
          </div>
          <div className="control-changes">
            <ChangeRow k="output" scene={scene} onToggle={setChange}>
              <select
                className="control-select"
                value={findDevice(outputs, scene.output)?.id ?? ""}
                disabled={!scene.changes.output}
                aria-label="Saída da cena"
                onChange={(event) => {
                  const device = outputs.find((item) => item.id === event.target.value);
                  if (device) update({ output: toDeviceRef(device) });
                }}
              >
                {(!scene.output || savedOutputMissing) && (
                  <option value="">
                    {scene.output ? `${scene.output.name} (desconectado)` : "Escolha a saída"}
                  </option>
                )}
                {outputs.map((device) => (
                  <option key={device.id} value={device.id}>
                    {shortDeviceName(device)}
                  </option>
                ))}
              </select>
            </ChangeRow>
            <ChangeRow k="voice" scene={scene} onToggle={setChange}>
              <Segmented
                label="Rota da voz"
                value={scene.voice}
                disabled={!scene.changes.voice}
                options={[
                  { value: "cable", label: "Pelo cabo · voz + Sons" },
                  { value: "direct", label: "Microfone direto" },
                ]}
                onChange={(voice) => update({ voice })}
              />
              <small className="control-hint">
                {scene.voice === "cable"
                  ? "Microfone padrão = o cabo, com o \"Escutar\" do seu microfone tocando nele: a reunião ouve sua voz e os Sons do Desk."
                  : "Microfone padrão = o seu microfone, sem \"Escutar\": a reunião ouve só a sua voz; os Sons não chegam lá."}
              </small>
            </ChangeRow>
            <ChangeRow k="volumes" scene={scene} onToggle={setChange}>
              {(
                [
                  ["output", "Saída"],
                  ["mic", "Microfone"],
                  ["sons", "Sons no cabo"],
                  ["monitor", "Retorno no fone"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="control-mini">
                  <span>{label}</span>
                  <VolumeSlider
                    label={`${label} da cena`}
                    value={scene.volumes[key]}
                    disabled={!scene.changes.volumes}
                    onChange={(value) => update({ volumes: { ...scene.volumes, [key]: value } })}
                  />
                </div>
              ))}
            </ChangeRow>
            <ChangeRow k="apps" scene={scene} onToggle={setChange}>
              {scene.apps.length === 0 && (
                <small className="control-hint">Nenhum app. Adicione um que esteja tocando agora.</small>
              )}
              {scene.apps.map((app) => (
                <div key={app.key} className="control-mini control-mini--app">
                  <span>{app.name}</span>
                  <VolumeSlider
                    label={`Volume do ${app.name} na cena`}
                    value={app.volume}
                    disabled={!scene.changes.apps}
                    onChange={(value) =>
                      update({
                        apps: scene.apps.map((item) =>
                          item.key === app.key ? { ...item, volume: value } : item,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="control-remove"
                    aria-label={`Tirar ${app.name} da cena`}
                    disabled={!scene.changes.apps}
                    onClick={() => update({ apps: scene.apps.filter((item) => item.key !== app.key) })}
                  >
                    ×
                  </button>
                </div>
              ))}
              {addableApps.length > 0 && (
                <select
                  className="control-select"
                  value=""
                  disabled={!scene.changes.apps}
                  aria-label="Adicionar app à cena"
                  onChange={(event) => {
                    const app = addableApps.find((item) => item.key === event.target.value);
                    if (app) {
                      update({
                        apps: [...scene.apps, { key: app.key, name: app.name, volume: app.volume }],
                      });
                    }
                  }}
                >
                  <option value="">+ Adicionar app aberto…</option>
                  {addableApps.map((app) => (
                    <option key={app.key} value={app.key}>
                      {app.name}
                    </option>
                  ))}
                </select>
              )}
            </ChangeRow>
            <ChangeRow k="dnd" scene={scene} onToggle={setChange}>
              <Segmented
                label="Não perturbe da cena"
                value={scene.dnd ? "on" : "off"}
                disabled={!scene.changes.dnd || !state.dnd.available}
                options={[
                  { value: "on", label: "Ligado" },
                  { value: "off", label: "Desligado" },
                ]}
                onChange={(value) => update({ dnd: value === "on" })}
              />
              {!state.dnd.available && (
                <small className="control-hint">Este Windows não deixou o Desk mexer no Não perturbe.</small>
              )}
            </ChangeRow>
          </div>

          <p className="control-callout">
            <strong>Teams e Meet no microfone “Padrão do sistema”.</strong> Assim é a cena que
            decide se a reunião ouve o microfone direto ou o cabo, sem mexer no app.
          </p>

          <div className="control-actions">
            <button type="button" className="button active" onClick={() => onApplyScene(scene)}>
              Aplicar agora
            </button>
            <button
              type="button"
              className="button"
              onClick={() =>
                update(captureScene(scene, state, settings, soundboard))
              }
            >
              Copiar do que está valendo agora
            </button>
            {confirmDelete ? (
              <span className="control-confirm">
                Excluir “{scene.name}”?
                <button type="button" className="button control-danger" onClick={remove}>
                  Excluir
                </button>
                <button type="button" className="button" onClick={() => setConfirmDelete(false)}>
                  Cancelar
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="button control-danger-text"
                onClick={() => setConfirmDelete(true)}
              >
                Excluir cena
              </button>
            )}
            <span className="control-saved">Salva sozinha</span>
          </div>
        </ControlSection>
      )}
    </>
  );
}

function ChangeRow({
  k,
  scene,
  onToggle,
  children,
}: {
  k: keyof AudioSceneChanges;
  scene: AudioScene;
  onToggle: (key: keyof AudioSceneChanges, on: boolean) => void;
  children: React.ReactNode;
}) {
  const id = `scene-change-${k}`;
  const on = scene.changes[k];
  return (
    <div className={["control-change", on ? "" : "control-change--off"].filter(Boolean).join(" ")}>
      <input
        id={id}
        type="checkbox"
        checked={on}
        onChange={(event) => onToggle(k, event.target.checked)}
      />
      <label htmlFor={id}>{CHANGE_LABELS[k]}</label>
      <div className="control-change-body">{children}</div>
    </div>
  );
}
