import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { shortcutTileStyle } from "../shortcuts/shortcutColors";
import {
  DEFAULT_SOUND_COLOR,
  DEFAULT_SOUND_COLOR2,
  SOUND_AUDIO_EXTENSIONS,
  SOUND_MAX_BYTES,
} from "../../../shared/soundboard";
import {
  forgetSoundAudio,
  listAudioOutputs,
  playPreview,
  previewSavedSound,
  resolveOutputDevice,
  stopPreview,
  type AudioOutputDevice,
} from "./soundPlayer";
import type {
  SaveSoundInput,
  SoundboardSettings,
  SoundItem,
} from "../../../shared/contracts";

interface SoundForm {
  id?: number;
  name: string;
  emoji: string;
  color: string;
  color2: string;
  volume: number;
  gridSlot: number | null;
  /** Arquivo novo escolhido no editor (ao criar, ou para trocar o audio). */
  file: File | null;
  /** Nome do arquivo ja salvo, so para exibir. */
  savedFileName: string | null;
}

const EMPTY_FORM: SoundForm = {
  name: "",
  emoji: "",
  color: DEFAULT_SOUND_COLOR,
  color2: DEFAULT_SOUND_COLOR2,
  volume: 1,
  gridSlot: null,
  file: null,
  savedFileName: null,
};

const AUDIO_ACCEPT = Object.keys(SOUND_AUDIO_EXTENSIONS)
  .map((extension) => `.${extension}`)
  .join(",");

const fileExtension = (name: string) =>
  name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";

const fileBaseName = (name: string) => name.replace(/\.[^.]+$/, "").trim();

const deviceLabel = (device: AudioOutputDevice) =>
  device.label || "Saída sem nome";

export function SoundboardSettingsPanel({
  sounds,
  settings,
  onSettingsChange,
  onSave,
  onDelete,
  onPlace,
  createAtSlot,
  onCreateRequestHandled,
}: {
  sounds: SoundItem[];
  settings: SoundboardSettings;
  onSettingsChange: (patch: Partial<SoundboardSettings>) => Promise<void>;
  onSave: (input: SaveSoundInput) => Promise<SoundItem>;
  onDelete: (id: number) => Promise<void>;
  onPlace: (id: number, slot: number) => Promise<void>;
  createAtSlot?: number | null;
  onCreateRequestHandled?: () => void;
}) {
  const [devices, setDevices] = useState<AudioOutputDevice[]>([]);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [form, setForm] = useState<SoundForm>(EMPTY_FORM);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const onCreateRequestHandledRef = useRef(onCreateRequestHandled);
  onCreateRequestHandledRef.current = onCreateRequestHandled;

  const slotCount = settings.grid.columns * settings.grid.rows;
  const output = resolveOutputDevice(devices, settings);

  useEffect(() => {
    const load = () =>
      void listAudioOutputs()
        .then((list) => {
          setDevices(list);
          setDevicesError(null);
        })
        .catch(() => setDevicesError("Não foi possível listar as saídas de áudio."));
    load();
    navigator.mediaDevices.addEventListener("devicechange", load);
    return () => navigator.mediaDevices.removeEventListener("devicechange", load);
  }, []);

  const releasePreviewUrl = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
  };

  useEffect(
    () => () => {
      stopPreview();
      releasePreviewUrl();
    },
    [],
  );

  const reset = () => {
    stopPreview();
    releasePreviewUrl();
    setForm(EMPTY_FORM);
    setError(null);
    setEditorOpen(false);
  };

  const create = (slot?: number) => {
    const freeSlot = Array.from({ length: slotCount }, (_, index) => index).find(
      (index) => !sounds.some((sound) => sound.gridSlot === index),
    );
    setForm({
      ...EMPTY_FORM,
      gridSlot:
        typeof slot === "number" && Number.isInteger(slot) && slot >= 0
          ? slot
          : (freeSlot ?? null),
    });
    setError(null);
    setEditorOpen(true);
  };

  const edit = (sound: SoundItem) => {
    setForm({
      id: sound.id,
      name: sound.name,
      emoji: sound.emoji,
      color: sound.color,
      color2: sound.color2,
      volume: sound.volume,
      gridSlot: sound.gridSlot,
      file: null,
      savedFileName: sound.fileName,
    });
    setError(null);
    setEditorOpen(true);
  };

  useEffect(() => {
    if (createAtSlot === null || createAtSlot === undefined) return;
    create(createAtSlot);
    onCreateRequestHandledRef.current?.();
  }, [createAtSlot]);

  useEffect(() => {
    if (!editorOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc" || event.code === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        reset();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [editorOpen]);

  const chooseFile = (file: File | undefined) => {
    if (!file) return;
    if (!SOUND_AUDIO_EXTENSIONS[fileExtension(file.name)]) {
      setError("Formato não suportado. Use mp3, wav, ogg, m4a, aac, flac ou webm.");
      return;
    }
    if (file.size > SOUND_MAX_BYTES) {
      setError("O áudio deve ter no máximo 20 MB.");
      return;
    }
    setError(null);
    setForm((current) => ({
      ...current,
      file,
      name: current.name.trim() ? current.name : fileBaseName(file.name),
    }));
  };

  const preview = async () => {
    try {
      if (form.file) {
        stopPreview();
        releasePreviewUrl();
        previewUrlRef.current = URL.createObjectURL(form.file);
        await playPreview(previewUrlRef.current, form.volume, settings);
        return;
      }
      const saved = sounds.find((sound) => sound.id === form.id);
      if (saved) await previewSavedSound(saved, form.volume, settings);
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : "Não foi possível tocar o áudio.",
      );
    }
  };

  const submit = async () => {
    if (!form.id && !form.file) {
      setError("Escolha o arquivo de áudio.");
      return;
    }
    setSaving(true);
    try {
      const audio = form.file
        ? {
            bytes: new Uint8Array(await form.file.arrayBuffer()),
            extension: fileExtension(form.file.name),
          }
        : undefined;
      if (form.id !== undefined && audio) forgetSoundAudio(form.id);
      const saved = await onSave({
        id: form.id,
        name: form.name,
        emoji: form.emoji,
        color: form.color,
        color2: form.color2,
        volume: form.volume,
        gridSlot: form.gridSlot ?? undefined,
        audio,
      });
      // Slot ocupado: o save cai no proximo livre; place faz a troca com o ocupante
      if (form.gridSlot !== null && form.gridSlot !== saved.gridSlot) {
        await onPlace(saved.id, form.gridSlot);
      }
      reset();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (sound: SoundItem) => {
    if (!window.confirm(`Excluir o som "${sound.name}"?`)) return;
    forgetSoundAudio(sound.id);
    await onDelete(sound.id);
  };

  const portalRoot =
    typeof document !== "undefined"
      ? document.querySelector<HTMLElement>(".app")
      : null;

  const slotLabel = (slot: number) => {
    const occupant = sounds.find(
      (sound) => sound.gridSlot === slot && sound.id !== form.id,
    );
    return occupant
      ? `${slot + 1} · troca com "${occupant.name}"`
      : `${slot + 1}`;
  };

  const editorModal =
    editorOpen &&
    createPortal(
      <div
        className="shortcut-modal-backdrop shortcut-modal-backdrop--editor"
        onClick={(event) => {
          if (event.target === event.currentTarget) reset();
        }}
      >
        <section
          className="shortcut-editor-modal shortcut-form"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sound-editor-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="shortcut-editor-heading">
            <div>
              <span className="eyebrow">{form.id ? "EDITAR" : "NOVO"}</span>
              <h3 id="sound-editor-title">
                {form.id ? form.name || "Editar som" : "Novo som"}
              </h3>
            </div>
            <button
              type="button"
              className="modal-close-button"
              aria-label="Fechar"
              title="Fechar"
              onClick={reset}
            />
          </div>
          <div className="shortcut-icon-field sound-file-field">
            <span>Arquivo de áudio</span>
            <div>
              <span className="sound-file-name">
                {form.file?.name ??
                  (form.savedFileName ? "Áudio salvo" : "Nenhum arquivo")}
              </span>
              <label className="button shortcut-icon-upload">
                {form.file || form.savedFileName ? "Trocar" : "Escolher"}
                <input
                  type="file"
                  accept={AUDIO_ACCEPT}
                  onChange={(event) => {
                    chooseFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
              {(form.file || form.savedFileName) && (
                <button
                  type="button"
                  className="button"
                  onClick={() => void preview()}
                >
                  Ouvir
                </button>
              )}
            </div>
          </div>
          <label>
            <span>Nome</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label>
            <span>Emoji (opcional)</span>
            <input
              value={form.emoji}
              maxLength={16}
              placeholder="😂"
              onChange={(event) => setForm({ ...form, emoji: event.target.value })}
            />
          </label>
          <label>
            <span>Volume do som · {Math.round(form.volume * 100)}%</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={form.volume}
              onChange={(event) =>
                setForm({ ...form, volume: Number(event.target.value) })
              }
            />
          </label>
          <label>
            <span>Posição na grade</span>
            <select
              value={form.gridSlot ?? ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  gridSlot:
                    event.target.value === "" ? null : Number(event.target.value),
                })
              }
            >
              {form.gridSlot === null && <option value="">Automática</option>}
              {Array.from({ length: slotCount }, (_, slot) => (
                <option key={slot} value={slot}>
                  {slotLabel(slot)}
                </option>
              ))}
            </select>
          </label>
          <div className="shortcut-color-fields">
            <label>
              <span>Cor 1</span>
              <input
                type="color"
                value={form.color}
                onChange={(event) => setForm({ ...form, color: event.target.value })}
              />
            </label>
            <label>
              <span>Cor 2</span>
              <input
                type="color"
                value={form.color2}
                onChange={(event) => setForm({ ...form, color2: event.target.value })}
              />
            </label>
            <span
              className="shortcut-color-preview"
              style={shortcutTileStyle(form.color, form.color2)}
              aria-hidden="true"
            />
          </div>
          {error && <p className="shortcut-form-error">{error}</p>}
          <div className="shortcut-form-actions">
            <button type="button" className="button" onClick={reset}>
              Cancelar
            </button>
            <button
              type="button"
              className="button active"
              disabled={saving}
              onClick={() => void submit()}
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </section>
      </div>,
      portalRoot ?? document.body,
    );

  return (
    <>
      <section className="setting-group">
        <h3>Microfone virtual</h3>
        <p className="muted">
          Os sons tocam numa saída do cabo virtual (VB-Cable). No Teams/Meet,
          escolha o outro lado do cabo como microfone; sua voz entra nele pelo
          Windows, em “Escutar este dispositivo” no seu microfone.
        </p>
        <label className="display-selector">
          <span>Saída do cabo</span>
          <select
            value={output?.deviceId ?? ""}
            onChange={(event) => {
              const device = devices.find(
                (item) => item.deviceId === event.target.value,
              );
              void onSettingsChange({
                outputDeviceId: device?.deviceId ?? "",
                outputDeviceLabel: device?.label ?? "",
              });
            }}
          >
            {!output && <option value="">Nenhuma encontrada</option>}
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {deviceLabel(device)}
              </option>
            ))}
          </select>
        </label>
        {!output && settings.outputDeviceLabel && (
          <p className="shortcut-form-error">
            “{settings.outputDeviceLabel}” não está conectada.
          </p>
        )}
        {devicesError && <p className="shortcut-form-error">{devicesError}</p>}
        <label className="sound-volume-field">
          <span>Volume no microfone · {Math.round(settings.volume * 100)}%</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.volume}
            onChange={(event) =>
              void onSettingsChange({ volume: Number(event.target.value) })
            }
          />
        </label>
      </section>

      <section className="setting-group">
        <h3>Retorno</h3>
        <button
          type="button"
          className="setting-action"
          onClick={() =>
            void onSettingsChange({ monitorEnabled: !settings.monitorEnabled })
          }
        >
          <span>Ouvir os sons no fone</span>
          <strong>{settings.monitorEnabled ? "Ativo" : "Desativado"}</strong>
        </button>
        {settings.monitorEnabled && (
          <>
            <label className="display-selector">
              <span>Saída do retorno</span>
              <select
                value={
                  devices.find(
                    (device) =>
                      device.deviceId === settings.monitorDeviceId ||
                      (settings.monitorDeviceLabel &&
                        device.label === settings.monitorDeviceLabel),
                  )?.deviceId ?? ""
                }
                onChange={(event) => {
                  const device = devices.find(
                    (item) => item.deviceId === event.target.value,
                  );
                  void onSettingsChange({
                    monitorDeviceId: device?.deviceId ?? "",
                    monitorDeviceLabel: device?.label ?? "",
                  });
                }}
              >
                <option value="">Padrão do Windows</option>
                {devices
                  .filter((device) => device.deviceId !== output?.deviceId)
                  .map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {deviceLabel(device)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="sound-volume-field">
              <span>
                Volume no fone · {Math.round(settings.monitorVolume * 100)}%
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.monitorVolume}
                onChange={(event) =>
                  void onSettingsChange({
                    monitorVolume: Number(event.target.value),
                  })
                }
              />
            </label>
          </>
        )}
      </section>

      <section className="setting-group shortcut-settings-list">
        <div className="shortcut-list-heading">
          <div>
            <h3>Seus sons</h3>
            <p className="muted">Clique em um item para editar.</p>
          </div>
          <div className="shortcut-list-actions">
            <button
              type="button"
              className="button shortcut-add-button"
              aria-label="Adicionar som"
              title="Adicionar som"
              onClick={() => create()}
            />
          </div>
        </div>
        <div className="shortcut-grid-dimensions">
          <label>
            <span>Colunas</span>
            <input
              type="number"
              min={1}
              max={8}
              value={settings.grid.columns}
              onChange={(event) =>
                void onSettingsChange({
                  grid: { ...settings.grid, columns: Number(event.target.value) },
                })
              }
            />
          </label>
          <label>
            <span>Linhas</span>
            <input
              type="number"
              min={1}
              max={6}
              value={settings.grid.rows}
              onChange={(event) =>
                void onSettingsChange({
                  grid: { ...settings.grid, rows: Number(event.target.value) },
                })
              }
            />
          </label>
        </div>
        {sounds.length === 0 && (
          <button
            type="button"
            className="shortcuts-empty shortcut-settings-empty"
            onClick={() => create()}
          >
            <strong>Nenhum som cadastrado</strong>
            <span>Adicione um mp3, wav ou ogg.</span>
          </button>
        )}
        {sounds.map((sound) => (
          <div key={sound.id} className="shortcut-settings-row">
            <button
              type="button"
              className="shortcut-edit"
              onClick={() => edit(sound)}
            >
              <span
                className="shortcut-color-swatch sound-swatch"
                style={shortcutTileStyle(sound.color, sound.color2)}
              >
                {sound.emoji}
              </span>
              <strong>{sound.name}</strong>
              <small>posição {sound.gridSlot + 1}</small>
            </button>
            <button
              type="button"
              className="shortcut-delete-button"
              aria-label={`Excluir ${sound.name}`}
              title="Excluir"
              onClick={() => void remove(sound)}
            />
          </div>
        ))}
      </section>
      {editorModal}
    </>
  );
}
