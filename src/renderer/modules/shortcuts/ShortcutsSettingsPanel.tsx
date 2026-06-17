import { useEffect, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import {
  DEFAULT_SHORTCUT_COLOR,
  DEFAULT_SHORTCUT_COLOR2,
  shortcutTileStyle,
} from "./shortcutColors";
import type {
  SaveShortcutInput,
  ShortcutGridSettings,
  ShortcutItem,
  ShortcutType,
} from "../../../shared/contracts";

const EMPTY_FORM: SaveShortcutInput = {
  name: "",
  type: "app",
  target: "",
  args: [],
  workingDirectory: "",
  color: DEFAULT_SHORTCUT_COLOR,
  color2: DEFAULT_SHORTCUT_COLOR2,
  iconDataUrl: null,
  imageOnly: false,
  confirmBeforeRun: false,
};

const TYPE_SYMBOLS: Record<ShortcutItem["type"], string> = {
  app: "APP",
  file: "FILE",
  url: "WEB",
  batch: "BAT",
  powershell: "PS",
};

export function ShortcutsSettingsPanel({
  shortcuts,
  onSave,
  onDelete,
  onPlace,
  gridSettings,
  onGridSettingsChange,
  createAtSlot,
  onCreateRequestHandled,
}: {
  shortcuts: ShortcutItem[];
  gridSettings: ShortcutGridSettings;
  onSave: (input: SaveShortcutInput) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onPlace: (id: number, slot: number) => Promise<void>;
  onGridSettingsChange: (value: ShortcutGridSettings) => Promise<void>;
  createAtSlot?: number | null;
  onCreateRequestHandled?: () => void;
}) {
  const [form, setForm] = useState<SaveShortcutInput>(EMPTY_FORM);
  const [argsText, setArgsText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const onCreateRequestHandledRef = useRef(onCreateRequestHandled);

  onCreateRequestHandledRef.current = onCreateRequestHandled;

  const reset = () => {
    setForm(EMPTY_FORM);
    setArgsText("");
    setError(null);
    setEditorOpen(false);
  };

  const create = (slot?: number) => {
    const gridSlot =
      typeof slot === "number" && Number.isInteger(slot) && slot >= 0
        ? slot
        : undefined;
    setForm(
      gridSlot !== undefined ? { ...EMPTY_FORM, gridSlot } : { ...EMPTY_FORM },
    );
    setArgsText("");
    setError(null);
    setEditorOpen(true);
  };

  useEffect(() => {
    if (!organizerOpen) {
      setDraggedId(null);
      setDragOverSlot(null);
    }
  }, [organizerOpen]);

  useEffect(() => {
    if (createAtSlot === null || createAtSlot === undefined) return;
    create(createAtSlot);
    onCreateRequestHandledRef.current?.();
  }, [createAtSlot]);

  useEffect(() => {
    if (!editorOpen && !organizerOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc" || event.code === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (editorOpen) {
          reset();
          return;
        }
        setOrganizerOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [editorOpen, organizerOpen]);

  const edit = (item: ShortcutItem) => {
    setForm({ ...item });
    setArgsText(item.args.join("\n"));
    setError(null);
    setEditorOpen(true);
  };

  const submit = async () => {
    try {
      await onSave({
        ...form,
        args: argsText
          .split(/\r?\n/)
          .map((value) => value.trim())
          .filter(Boolean),
      });
      reset();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Falha ao salvar.",
      );
    }
  };

  const loadIcon = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > 2_000_000) {
      setError("A imagem deve ter no maximo 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setForm((current) => ({
          ...current,
          iconDataUrl: reader.result as string,
        }));
        setError(null);
      }
    };
    reader.onerror = () => setError("Nao foi possivel ler a imagem.");
    reader.readAsDataURL(file);
  };

  const dropAt = async (slot: number, id = draggedId) => {
    if (id === null) return;
    setDraggedId(null);
    setDragOverSlot(null);
    await onPlace(id, slot);
  };

  const clearDragState = () => {
    setDraggedId(null);
    setDragOverSlot(null);
  };

  const getOrganizerSlotFromPoint = (clientX: number, clientY: number) => {
    const element = document.elementFromPoint(clientX, clientY);
    const slotElement = element?.closest<HTMLElement>("[data-organizer-slot]");
    if (!slotElement) return null;
    const slot = Number(slotElement.dataset.organizerSlot);
    return Number.isInteger(slot) && slot >= 0 ? slot : null;
  };

  const handleOrganizerPointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    item: ShortcutItem,
    slot: number,
  ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggedId(item.id);
    setDragOverSlot(slot);
  };

  const handleOrganizerPointerMove = (
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const slot = getOrganizerSlotFromPoint(event.clientX, event.clientY);
    if (slot !== null) {
      setDragOverSlot(slot);
    }
  };

  const handleOrganizerPointerUp = (
    event: PointerEvent<HTMLButtonElement>,
    item: ShortcutItem,
  ) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const slot =
      getOrganizerSlotFromPoint(event.clientX, event.clientY) ?? dragOverSlot;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (slot !== null) {
      void dropAt(slot, item.id);
      return;
    }
    clearDragState();
  };

  const handleOrganizerPointerCancel = (
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    clearDragState();
  };

  const renderOrganizerTile = (
    item: ShortcutItem,
    mode: "item" | "preview",
    slot: number,
  ) => {
    const content = (
      <>
        <span
          className="shortcut-tile-bg"
          aria-hidden="true"
          style={shortcutTileStyle(item.color, item.color2)}
        />
        {item.iconDataUrl ? (
          <img
            className="shortcut-organizer-image"
            src={item.iconDataUrl}
            alt=""
            draggable={false}
          />
        ) : (
          <span className="shortcut-organizer-symbol">
            {TYPE_SYMBOLS[item.type]}
          </span>
        )}
        <span className="shortcut-organizer-item-label">
          <strong>{item.name}</strong>
        </span>
      </>
    );

    if (mode === "preview") {
      return (
        <div
          className="shortcut-organizer-item shortcut-organizer-preview"
          aria-hidden="true"
        >
          {content}
        </div>
      );
    }

    return (
      <button
        type="button"
        className={[
          "shortcut-organizer-item",
          draggedId === item.id ? "dragging" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onPointerDown={(event) =>
          handleOrganizerPointerDown(event, item, slot)
        }
        onPointerMove={handleOrganizerPointerMove}
        onPointerUp={(event) => handleOrganizerPointerUp(event, item)}
        onPointerCancel={handleOrganizerPointerCancel}
      >
        {content}
      </button>
    );
  };

  const getOrganizerPreviewAtSlot = (
    slot: number,
    draggedItem: ShortcutItem | undefined,
    sourceSlot: number | null,
  ): ShortcutItem | null => {
    if (!draggedItem || dragOverSlot === null) return null;
    if (slot === dragOverSlot) return draggedItem;
    if (
      sourceSlot !== null &&
      slot === sourceSlot &&
      dragOverSlot !== sourceSlot
    ) {
      const occupant = shortcuts.find(
        (shortcut) => shortcut.gridSlot === dragOverSlot,
      );
      if (occupant && occupant.id !== draggedItem.id) return occupant;
    }
    return null;
  };

  const isOrganizerItemHidden = (
    item: ShortcutItem,
    slot: number,
    draggedItem: ShortcutItem | undefined,
    sourceSlot: number | null,
    slotCount: number,
  ) => {
    if (!draggedItem || item.id === draggedItem.id) return false;
    for (let index = 0; index < slotCount; index += 1) {
      if (index === slot) continue;
      const preview = getOrganizerPreviewAtSlot(
        index,
        draggedItem,
        sourceSlot,
      );
      if (preview?.id === item.id) return true;
    }
    return false;
  };

  const openOrganizer = () => {
    void onGridSettingsChange(gridSettings).then(() => setOrganizerOpen(true));
  };

  const portalRoot =
    typeof document !== "undefined"
      ? document.querySelector<HTMLElement>(".app")
      : null;

  const organizerModal =
    organizerOpen &&
    createPortal(
      <div
        className="shortcut-modal-backdrop"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setOrganizerOpen(false);
          }
        }}
      >
        <section
          className="shortcut-organizer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcut-organizer-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="shortcut-organizer-heading">
            <div>
              <span className="eyebrow">ORGANIZAR</span>
              <h3 id="shortcut-organizer-title">Grid de atalhos</h3>
            </div>
            <button
              type="button"
              className="modal-close-button"
              aria-label="Fechar"
              title="Fechar"
              onClick={() => setOrganizerOpen(false)}
            />
          </div>
          <div className="shortcut-grid-dimensions">
            <label>
              <span>Colunas</span>
              <input
                type="number"
                min={1}
                max={8}
                value={gridSettings.columns}
                onChange={(event) =>
                  void onGridSettingsChange({
                    ...gridSettings,
                    columns: Number(event.target.value),
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
                value={gridSettings.rows}
                onChange={(event) =>
                  void onGridSettingsChange({
                    ...gridSettings,
                    rows: Number(event.target.value),
                  })
                }
              />
            </label>
          </div>
          <div
            className={[
              "shortcut-organizer-grid",
              draggedId !== null ? "shortcut-organizer-grid--dragging" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={
              {
                "--shortcut-columns": gridSettings.columns,
              } as React.CSSProperties
            }
          >
            {Array.from({
              length: gridSettings.columns * gridSettings.rows,
            }).map((_, slot) => {
              const slotCount = gridSettings.columns * gridSettings.rows;
              const draggedItem = shortcuts.find(
                (shortcut) => shortcut.id === draggedId,
              );
              const sourceSlot = draggedItem?.gridSlot ?? null;
              const item = shortcuts.find(
                (shortcut) => shortcut.gridSlot === slot,
              );
              const previewItem = getOrganizerPreviewAtSlot(
                slot,
                draggedItem,
                sourceSlot,
              );
              const showItem =
                item &&
                !isOrganizerItemHidden(
                  item,
                  slot,
                  draggedItem,
                  sourceSlot,
                  slotCount,
                );
              const isFilled = Boolean(
                previewItem || (showItem && item && item.id !== draggedId),
              );

              return (
                <div
                  key={slot}
                  data-organizer-slot={slot}
                  className={[
                    "shortcut-organizer-slot",
                    isFilled ? "shortcut-organizer-slot--filled" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="shortcut-slot-number">{slot + 1}</span>
                  {showItem && item && renderOrganizerTile(item, "item", slot)}
                  {previewItem && renderOrganizerTile(previewItem, "preview", slot)}
                </div>
              );
            })}
          </div>
          <p className="muted shortcut-organizer-hint">
            Arraste os atalhos para alterar a posição.
          </p>
        </section>
      </div>,
      portalRoot ?? document.body,
    );

  const editorModal =
    editorOpen &&
    createPortal(
      <div
        className="shortcut-modal-backdrop shortcut-modal-backdrop--editor"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            reset();
          }
        }}
      >
        <section
          className="shortcut-editor-modal shortcut-form"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shortcut-editor-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="shortcut-editor-heading">
            <div>
              <span className="eyebrow">{form.id ? "EDITAR" : "NOVO"}</span>
              <h3 id="shortcut-editor-title">
                {form.id ? form.name || "Editar atalho" : "Novo atalho"}
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
          <label>
            <span>Nome</span>
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label>
            <span>Tipo</span>
            <select
              value={form.type}
              onChange={(event) =>
                setForm({ ...form, type: event.target.value as ShortcutType })
              }
            >
              <option value="app">Aplicativo</option>
              <option value="file">Arquivo</option>
              <option value="url">URL</option>
              <option value="batch">Batch (.bat/.cmd)</option>
              <option value="powershell">PowerShell (.ps1)</option>
            </select>
          </label>
          <label>
            <span>Destino</span>
            <input
              value={form.target}
              placeholder="C:\caminho\arquivo.exe"
              onChange={(event) =>
                setForm({ ...form, target: event.target.value })
              }
            />
          </label>
          <label>
            <span>Argumentos (um por linha)</span>
            <textarea
              value={argsText}
              onChange={(event) => setArgsText(event.target.value)}
            />
          </label>
          <label>
            <span>Diretorio de trabalho (opcional)</span>
            <input
              value={form.workingDirectory ?? ""}
              onChange={(event) =>
                setForm({ ...form, workingDirectory: event.target.value })
              }
            />
          </label>
          <div className="shortcut-color-fields">
            <label>
              <span>Cor 1</span>
              <input
                type="color"
                value={form.color}
                onChange={(event) =>
                  setForm({ ...form, color: event.target.value })
                }
              />
            </label>
            <label>
              <span>Cor 2</span>
              <input
                type="color"
                value={form.color2 ?? DEFAULT_SHORTCUT_COLOR2}
                onChange={(event) =>
                  setForm({ ...form, color2: event.target.value })
                }
              />
            </label>
            <span
              className="shortcut-color-preview"
              style={shortcutTileStyle(
                form.color ?? DEFAULT_SHORTCUT_COLOR,
                form.color2 ?? DEFAULT_SHORTCUT_COLOR2,
              )}
              aria-hidden="true"
            />
          </div>
          <label className="shortcut-icon-field">
            <span>Imagem do atalho</span>
            <div>
              {form.iconDataUrl ? (
                <img src={form.iconDataUrl} alt="Pre-visualizacao do icone" />
              ) : (
                <span className="shortcut-icon-placeholder">Sem imagem</span>
              )}
              <label className="button shortcut-icon-upload">
                Escolher imagem
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) => loadIcon(event.target.files?.[0])}
                />
              </label>
              {form.iconDataUrl && (
                <button
                  className="button"
                  type="button"
                  onClick={() => setForm({ ...form, iconDataUrl: null })}
                >
                  Remover
                </button>
              )}
            </div>
          </label>
          {form.iconDataUrl && (
            <label className="shortcut-confirm">
              <input
                type="checkbox"
                checked={Boolean(form.imageOnly)}
                onChange={(event) =>
                  setForm({ ...form, imageOnly: event.target.checked })
                }
              />
              <span>Exibir somente a imagem no card</span>
            </label>
          )}
          <label className="shortcut-confirm">
            <input
              type="checkbox"
              checked={form.confirmBeforeRun}
              onChange={(event) =>
                setForm({ ...form, confirmBeforeRun: event.target.checked })
              }
            />
            <span>Confirmar antes de executar</span>
          </label>
          {error && <p className="shortcut-form-error">{error}</p>}
          <div className="shortcut-form-actions">
            <button type="button" className="button" onClick={reset}>
              Cancelar
            </button>
            <button
              type="button"
              className="button active"
              onClick={() => void submit()}
            >
              Salvar
            </button>
          </div>
        </section>
      </div>,
      portalRoot ?? document.body,
    );

  return (
    <>
      <section className="setting-group shortcut-settings-list">
        <div className="shortcut-list-heading">
          <div>
            <h3>Seus atalhos</h3>
            <p className="muted">Clique em um item para editar.</p>
          </div>
          <div className="shortcut-list-actions">
            <button
              type="button"
              className="button shortcut-add-button"
              aria-label="Adicionar novo"
              title="Adicionar novo"
              onClick={() => create()}
            />
            <button
              type="button"
              className="button shortcut-organize-button"
              aria-label={`Organizar grid ${gridSettings.columns} por ${gridSettings.rows}`}
              onClick={openOrganizer}
            >
              Grid {gridSettings.columns} × {gridSettings.rows}
            </button>
          </div>
        </div>
        {shortcuts.length === 0 && (
          <button
            type="button"
            className="shortcuts-empty shortcut-settings-empty"
            onClick={() => create()}
          >
            <strong>Nenhum atalho criado</strong>
            <span>Adicione seu primeiro app ou comando.</span>
          </button>
        )}
        {shortcuts.map((item) => (
          <div key={item.id} className="shortcut-settings-row">
            <button
              type="button"
              className="shortcut-edit"
              onClick={() => edit(item)}
            >
              {item.iconDataUrl ? (
                <img src={item.iconDataUrl} alt="" />
              ) : (
                <span
                  className="shortcut-color-swatch"
                  style={shortcutTileStyle(item.color, item.color2)}
                />
              )}
              <strong>{item.name}</strong>
              <small>{item.type}</small>
            </button>
            <button
              type="button"
              className="shortcut-delete-button"
              aria-label={`Excluir ${item.name}`}
              title="Excluir"
              onClick={() => void onDelete(item.id)}
            />
          </div>
        ))}
      </section>
      {organizerModal}
      {editorModal}
    </>
  );
}
