import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_SOUND_COLOR,
  DEFAULT_SOUND_COLOR2,
  SOUND_AUDIO_EXTENSIONS,
  SOUND_GRID_MAX_COLUMNS,
  SOUND_GRID_MAX_ROWS,
  SOUND_MAX_BYTES,
  SOUND_PALETTE,
  soundSecondColor,
} from "../../../shared/soundboard";
import { SoundName } from "./SoundTileParts";
import { soundTileStyle } from "./soundLook";
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
  color: DEFAULT_SOUND_COLOR,
  color2: DEFAULT_SOUND_COLOR2,
  volume: 1,
  gridSlot: null,
  file: null,
  savedFileName: null,
};

/** Arraste na grade de sons: o que a tela mostra. */
interface DragView {
  id: number;
  /** Slot sob o ponteiro (onde o som cai). */
  overSlot: number;
  /** Passou do limiar: e arraste, nao toque. */
  moved: boolean;
}

/** O arraste por inteiro, fora do estado do React (o ponteiro anda mais rapido que o render). */
interface DragState extends DragView {
  startX: number;
  startY: number;
  /** Onde o ponteiro pegou o botao, para o fantasma nao pular. */
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

const DRAG_THRESHOLD = 6;

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
  editSoundId,
  onEditRequestHandled,
}: {
  sounds: SoundItem[];
  settings: SoundboardSettings;
  onSettingsChange: (patch: Partial<SoundboardSettings>) => Promise<void>;
  onSave: (input: SaveSoundInput) => Promise<SoundItem>;
  onDelete: (id: number) => Promise<void>;
  onPlace: (id: number, slot: number) => Promise<void>;
  createAtSlot?: number | null;
  onCreateRequestHandled?: () => void;
  /** Som a abrir no editor (o "Editar" do menu de segurar, no modulo). */
  editSoundId?: number | null;
  onEditRequestHandled?: () => void;
}) {
  const [devices, setDevices] = useState<AudioOutputDevice[]>([]);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [form, setForm] = useState<SoundForm>(EMPTY_FORM);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [drag, setDrag] = useState<DragView | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const onCreateRequestHandledRef = useRef(onCreateRequestHandled);
  onCreateRequestHandledRef.current = onCreateRequestHandled;
  const onEditRequestHandledRef = useRef(onEditRequestHandled);
  onEditRequestHandledRef.current = onEditRequestHandled;

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
    // Cor nova: a primeira da paleta que nenhum som usa ainda
    const used = new Set(sounds.map((sound) => sound.color.toLowerCase()));
    const [color, color2] =
      SOUND_PALETTE.find(([first]) => !used.has(first)) ??
      SOUND_PALETTE[sounds.length % SOUND_PALETTE.length];
    setForm({
      ...EMPTY_FORM,
      color,
      color2,
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
    if (editSoundId === null || editSoundId === undefined) return;
    const sound = sounds.find((item) => item.id === editSoundId);
    if (sound) edit(sound);
    onEditRequestHandledRef.current?.();
  }, [editSoundId]);

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

  // Renomear direto da lista, sem abrir o editor
  const quickSave = async (
    sound: SoundItem,
    patch: Partial<Pick<SaveSoundInput, "name">>,
  ) => {
    try {
      await onSave({
        id: sound.id,
        name: sound.name,
        color: sound.color,
        color2: sound.color2,
        volume: sound.volume,
        ...patch,
      });
      setListError(null);
    } catch (saveError) {
      setListError(saveError instanceof Error ? saveError.message : "Falha ao salvar.");
    }
  };

  const startRename = (sound: SoundItem) => {
    setRenamingId(sound.id);
    setRenameDraft(sound.name);
  };

  const commitRename = async (sound: SoundItem) => {
    const name = renameDraft.trim();
    setRenamingId(null);
    if (name && name !== sound.name) await quickSave(sound, { name });
  };

  // ---------- grade: arrastar troca de lugar; tocar sem arrastar abre o editor ----------
  const slotFromPoint = (clientX: number, clientY: number) => {
    const slotElement = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>("[data-sound-slot]");
    if (!slotElement) return null;
    const slot = Number(slotElement.dataset.soundSlot);
    return Number.isInteger(slot) && slot >= 0 ? slot : null;
  };

  // Ponteiro ouvido na janela, nao no botao: durante o arraste a grade redesenha a troca e o
  // botao que foi pego pode sumir (slot vazio), o que travava o arraste
  const latest = useRef({ sounds, edit, onPlace });
  latest.current = { sounds, edit, onPlace };

  const moveGhost = (x: number, y: number) => {
    const state = dragRef.current;
    const ghost = ghostRef.current;
    if (!state || !ghost) return;
    ghost.style.transform = `translate(${x - state.offsetX}px, ${y - state.offsetY}px)`;
  };

  const handleTilePointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    sound: SoundItem,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const box = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      id: sound.id,
      overSlot: sound.gridSlot,
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - box.left,
      offsetY: event.clientY - box.top,
      width: box.width,
      height: box.height,
    };
    setDrag({ id: sound.id, overSlot: sound.gridSlot, moved: false });
  };

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const finish = () => {
      dragRef.current = null;
      setDrag(null);
    };
    const handleMove = (event: globalThis.PointerEvent) => {
      const state = dragRef.current;
      if (!state) return;
      if (
        !state.moved &&
        Math.hypot(event.clientX - state.startX, event.clientY - state.startY) > DRAG_THRESHOLD
      ) {
        state.moved = true;
      }
      if (!state.moved) return;
      state.overSlot = slotFromPoint(event.clientX, event.clientY) ?? state.overSlot;
      moveGhost(event.clientX, event.clientY);
      setDrag((current) =>
        current && current.overSlot === state.overSlot && current.moved
          ? current
          : { id: state.id, overSlot: state.overSlot, moved: true },
      );
    };
    const handleUp = (event: globalThis.PointerEvent) => {
      const state = dragRef.current;
      finish();
      if (!state) return;
      const sound = latest.current.sounds.find((item) => item.id === state.id);
      if (!sound) return;
      if (!state.moved) {
        latest.current.edit(sound);
        return;
      }
      const slot = slotFromPoint(event.clientX, event.clientY) ?? state.overSlot;
      if (slot !== sound.gridSlot) void latest.current.onPlace(sound.id, slot);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", finish);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", finish);
      window.removeEventListener("keydown", handleKey);
    };
  }, [dragging]);

  const draggedSound = drag ? sounds.find((sound) => sound.id === drag.id) : undefined;
  const isDragging = Boolean(draggedSound && drag?.moved);
  const dragOverSlot = drag?.overSlot ?? null;

  // Durante o arraste a grade mostra o resultado: o som (apagado) no slot de destino e o
  // ocupante dele no slot de origem; o som de verdade vai no fantasma, com o ponteiro
  const soundShownAt = (slot: number): SoundItem | undefined => {
    const occupant = sounds.find((sound) => sound.gridSlot === slot);
    if (!draggedSound || dragOverSlot === null || !isDragging) return occupant;
    if (slot === dragOverSlot) return draggedSound;
    if (slot === draggedSound.gridSlot) {
      return sounds.find(
        (sound) => sound.gridSlot === dragOverSlot && sound.id !== draggedSound.id,
      );
    }
    return occupant;
  };

  const dragGhost =
    isDragging &&
    draggedSound &&
    dragRef.current &&
    createPortal(
      <div
        ref={(node) => {
          ghostRef.current = node;
          const state = dragRef.current;
          if (node && state && !node.style.transform) {
            node.style.transform = `translate(${state.startX - state.offsetX}px, ${state.startY - state.offsetY}px)`;
          }
        }}
        className="sound-organizer-ghost"
        style={{
          ...soundTileStyle(draggedSound.color, draggedSound.color2),
          width: dragRef.current.width,
          height: dragRef.current.height,
        }}
        aria-hidden="true"
      >
        <SoundName name={draggedSound.name} max={26} className="sound-mini-name" />
      </div>,
      document.body,
    );

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
          <div className="sound-color-field">
            <span>Cor</span>
            <div className="sound-color-options">
              {SOUND_PALETTE.map(([color, color2]) => {
                const selected = form.color.toLowerCase() === color;
                return (
                  <button
                    key={color}
                    type="button"
                    className={selected ? "sound-color-swatch selected" : "sound-color-swatch"}
                    style={soundTileStyle(color, color2)}
                    aria-label={`Cor ${color}`}
                    aria-pressed={selected}
                    onClick={() => setForm({ ...form, color, color2 })}
                  />
                );
              })}
              <label
                className={[
                  "sound-color-swatch",
                  "sound-color-custom",
                  SOUND_PALETTE.some(([color]) => color === form.color.toLowerCase())
                    ? ""
                    : "selected",
                ]
                  .filter(Boolean)
                  .join(" ")}
                title="Outra cor"
              >
                <input
                  type="color"
                  value={form.color}
                  aria-label="Outra cor"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      color: event.target.value,
                      color2: soundSecondColor(event.target.value),
                    })
                  }
                />
              </label>
            </div>
            <div className="sound-color-previews" aria-hidden="true">
              {[false, true].map((playing) => (
                <figure key={String(playing)}>
                  <span
                    className={
                      playing
                        ? "sound-tile sound-tile--playing sound-color-preview"
                        : "sound-tile sound-color-preview"
                    }
                    style={soundTileStyle(form.color, form.color2)}
                  >
                    <SoundName name={form.name.trim() || "Som"} max={34} />
                  </span>
                  <figcaption>{playing ? "Tocando" : "Parado"}</figcaption>
                </figure>
              ))}
            </div>
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
        <p className="sound-tip">
          <strong>No Meet/Teams, desligue o cancelamento de ruído.</strong> Ele trata
          os efeitos como barulho e eles chegam picotados na reunião (a voz passa
          normal). No Meet: ⋮ → Configurações → Áudio → Cancelamento de ruído.
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
            <p className="muted">
              Arraste na grade para trocar de lugar; toque num som para editar.
            </p>
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
              max={SOUND_GRID_MAX_COLUMNS}
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
              max={SOUND_GRID_MAX_ROWS}
              value={settings.grid.rows}
              onChange={(event) =>
                void onSettingsChange({
                  grid: { ...settings.grid, rows: Number(event.target.value) },
                })
              }
            />
          </label>
        </div>
        <div
          className={[
            "sound-organizer-grid",
            isDragging ? "sound-organizer-grid--dragging" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ "--sound-columns": settings.grid.columns } as React.CSSProperties}
        >
          {Array.from({ length: slotCount }, (_, slot) => {
            const sound = soundShownAt(slot);
            const isTarget = isDragging && slot === dragOverSlot;
            return (
              <div
                key={slot}
                data-sound-slot={slot}
                className={[
                  "sound-organizer-slot",
                  sound ? "sound-organizer-slot--filled" : "",
                  isTarget ? "sound-organizer-slot--target" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="shortcut-slot-number">{slot + 1}</span>
                {sound ? (
                  <button
                    type="button"
                    className={[
                      "sound-organizer-item",
                      isDragging && sound.id === drag?.id ? "sound-organizer-item--drop" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={soundTileStyle(sound.color, sound.color2)}
                    title={`${sound.name} · arraste para mover, toque para editar`}
                    aria-label={`${sound.name}: arraste para mover, toque para editar`}
                    onPointerDown={(event) => handleTilePointerDown(event, sound)}
                  >
                    <SoundName name={sound.name} max={26} className="sound-mini-name" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="sound-organizer-empty"
                    aria-label={`Adicionar som na posição ${slot + 1}`}
                    onClick={() => create(slot)}
                  >
                    +
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {sounds.some((sound) => sound.gridSlot >= slotCount) && (
          <p className="muted sound-organizer-hint">
            Há sons fora da grade: aumente colunas ou linhas para vê-los.
          </p>
        )}
        {listError && <p className="shortcut-form-error">{listError}</p>}
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
          <div key={sound.id} className="shortcut-settings-row sound-settings-row">
            <span
              className="sound-row-face"
              style={soundTileStyle(sound.color, sound.color2)}
              aria-hidden="true"
            />
            {renamingId === sound.id ? (
              <input
                className="sound-rename-input"
                value={renameDraft}
                autoFocus
                maxLength={60}
                aria-label="Nome do som"
                onChange={(event) => setRenameDraft(event.target.value)}
                onBlur={() => void commitRename(sound)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    setRenamingId(null);
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className="sound-row-name"
                title="Renomear"
                onClick={() => startRename(sound)}
              >
                <strong>{sound.name}</strong>
                <small>posição {sound.gridSlot + 1}</small>
              </button>
            )}
            <button
              type="button"
              className="sound-row-action sound-row-action--rename"
              aria-label={`Renomear ${sound.name}`}
              title="Renomear"
              onClick={() => startRename(sound)}
            />
            <button
              type="button"
              className="sound-row-action sound-row-action--edit"
              aria-label={`Editar ${sound.name}`}
              title="Editar (arquivo, volume, cor)"
              onClick={() => edit(sound)}
            />
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
      {dragGhost}
    </>
  );
}
