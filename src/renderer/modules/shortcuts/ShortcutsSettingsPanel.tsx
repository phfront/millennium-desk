import { useState } from "react";
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

export function ShortcutsSettingsPanel({
  shortcuts,
  onSave,
  onDelete,
  onReorder,
  onPlace,
  gridSettings,
  onGridSettingsChange,
}: {
  shortcuts: ShortcutItem[];
  gridSettings: ShortcutGridSettings;
  onSave: (input: SaveShortcutInput) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onReorder: (ids: number[]) => Promise<void>;
  onPlace: (id: number, slot: number) => Promise<void>;
  onGridSettingsChange: (value: ShortcutGridSettings) => Promise<void>;
}) {
  const [form, setForm] = useState<SaveShortcutInput>(EMPTY_FORM);
  const [argsText, setArgsText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<number | null>(null);

  const reset = () => {
    setForm(EMPTY_FORM);
    setArgsText("");
    setError(null);
    setEditorOpen(false);
  };

  const create = () => {
    setForm(EMPTY_FORM);
    setArgsText("");
    setError(null);
    setEditorOpen(true);
  };

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

  const move = async (index: number, offset: number) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= shortcuts.length) return;
    const ids = shortcuts.map((item) => item.id);
    [ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]];
    await onReorder(ids);
  };

  const dropAt = async (slot: number) => {
    if (draggedId === null) return;
    setDraggedId(null);
    await onPlace(draggedId, slot);
  };

  if (!editorOpen) {
    return (
      <section className="setting-group shortcut-settings-list">
        <div className="shortcut-list-heading">
          <div>
            <h3>Seus atalhos</h3>
            <p className="muted">Clique em um item para editar.</p>
          </div>
          <button className="button active" onClick={create}>
            Adicionar novo
          </button>
        </div>
        <button
          className="setting-action shortcut-organize-button"
          onClick={() => {
            void onGridSettingsChange(gridSettings).then(() =>
              setOrganizerOpen(true),
            );
          }}
        >
          <span>Organizar grid</span>
          <strong>
            {gridSettings.columns} × {gridSettings.rows}
          </strong>
        </button>
        {shortcuts.length === 0 && (
          <button
            className="shortcuts-empty shortcut-settings-empty"
            onClick={create}
          >
            <strong>Nenhum atalho criado</strong>
            <span>Adicione seu primeiro app ou comando.</span>
          </button>
        )}
        {shortcuts.map((item, index) => (
          <div key={item.id}>
            <button className="shortcut-edit" onClick={() => edit(item)}>
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
              aria-label="Mover para cima"
              onClick={() => void move(index, -1)}
              disabled={index === 0}
            >
              ↑
            </button>
            <button
              aria-label="Mover para baixo"
              onClick={() => void move(index, 1)}
              disabled={index === shortcuts.length - 1}
            >
              ↓
            </button>
            <button onClick={() => void onDelete(item.id)}>Excluir</button>
          </div>
        ))}
        {organizerOpen && (
          <div className="shortcut-organizer-backdrop">
            <section className="shortcut-organizer" role="dialog" aria-modal="true">
              <div className="shortcut-organizer-heading">
                <div>
                  <span className="eyebrow">ORGANIZAR</span>
                  <h3>Grid de atalhos</h3>
                </div>
                <button className="button" onClick={() => setOrganizerOpen(false)}>
                  Fechar
                </button>
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
                className="shortcut-organizer-grid"
                style={{
                  "--shortcut-columns": gridSettings.columns,
                } as React.CSSProperties}
              >
                {Array.from({
                  length: gridSettings.columns * gridSettings.rows,
                }).map((_, slot) => {
                  const item = shortcuts.find(
                    (shortcut) => shortcut.gridSlot === slot,
                  );
                  return (
                    <div
                      key={slot}
                      className="shortcut-organizer-slot"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => void dropAt(slot)}
                    >
                      <span className="shortcut-slot-number">{slot + 1}</span>
                      {item && (
                        <button
                          draggable
                          className={draggedId === item.id ? "dragging" : ""}
                          onDragStart={() => setDraggedId(item.id)}
                          onDragEnd={() => setDraggedId(null)}
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
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="muted">Arraste os atalhos para alterar a posição.</p>
            </section>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="setting-group shortcut-form">
      <div className="shortcut-editor-heading">
        <div>
          <span className="eyebrow">{form.id ? "EDITAR" : "NOVO"}</span>
          <h3>{form.id ? form.name : "Novo atalho"}</h3>
        </div>
        <button className="button" onClick={reset}>
          Voltar
        </button>
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
          onChange={(event) => setForm({ ...form, target: event.target.value })}
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
            onChange={(event) => setForm({ ...form, color: event.target.value })}
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
        <button className="button" onClick={reset}>
          Cancelar
        </button>
        <button className="button active" onClick={() => void submit()}>
          Salvar
        </button>
      </div>
    </section>
  );
}
