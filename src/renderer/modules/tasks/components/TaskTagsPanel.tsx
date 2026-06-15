import { useState } from "react";
import type { TaskTag } from "../../../../shared/contracts";
import { isTagColorPreset, TAG_COLORS } from "../tagUtils";
import { TaskTagPill } from "./TaskTagPill";

export function TaskTagsPanel({
  tags,
  readOnly,
  compact = false,
  onCreate,
  onUpdate,
  onDelete,
}: {
  tags: TaskTag[];
  readOnly: boolean;
  compact?: boolean;
  onCreate: (name: string, color: string) => void;
  onUpdate: (id: number, name: string, color: string) => void;
  onDelete: (id: number) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(TAG_COLORS[0]);
  const [editingTagId, setEditingTagId] = useState<number | null>(null);

  const resetForm = () => {
    setName("");
    setColor(TAG_COLORS[0]);
    setEditingTagId(null);
  };

  const editTag = (tag: TaskTag) => {
    setName(tag.name);
    setColor(tag.color);
    setEditingTagId(tag.id);
  };

  const submit = () => {
    const nextName = name.trim();
    if (!nextName || readOnly) return;
    if (editingTagId === null) {
      onCreate(nextName, color);
    } else {
      onUpdate(editingTagId, nextName, color);
    }
    resetForm();
  };

  return (
    <section
      className={
        compact ? "task-tags-section settings-tags-panel" : "task-tags-section"
      }
    >
      <div className="task-tags-header">
        <span>Tags</span>
        <span className="task-tags-count">{tags.length}</span>
      </div>
      {!readOnly && (
        <div className="tag-create-form">
          <input
            value={name}
            placeholder={editingTagId === null ? "Nome da tag" : "Editar nome"}
            aria-label={
              editingTagId === null ? "Nome da nova tag" : "Novo nome da tag"
            }
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
          />
          <div className="tag-color-options" aria-label="Cor da tag">
            {TAG_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={`Usar cor ${option}`}
                className={color === option ? "selected" : ""}
                style={{ backgroundColor: option }}
                onClick={() => setColor(option)}
              />
            ))}
            <label
              className={`custom-tag-color${isTagColorPreset(color) ? "" : " selected"}`}
              style={
                isTagColorPreset(color) ? undefined : { backgroundColor: color }
              }
            >
              <input
                aria-label="Escolher cor personalizada da tag"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
              />
              {isTagColorPreset(color) ? "+" : null}
            </label>
          </div>
          <div className="tag-form-actions">
            <button type="button" className="tag-create-button" onClick={submit}>
              {editingTagId === null ? "Criar tag" : "Salvar tag"}
            </button>
            {editingTagId !== null && (
              <button
                type="button"
                className="tag-cancel-button"
                onClick={resetForm}
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}
      {tags.length > 0 ? (
        <div className="tag-library">
          {tags.map((tag) => (
            <TaskTagPill
              key={tag.id}
              tag={tag}
              onEdit={readOnly ? undefined : () => editTag(tag)}
              onRemove={
                readOnly
                  ? undefined
                  : () => {
                      if (window.confirm(`Excluir a tag "${tag.name}"?`)) {
                        onDelete(tag.id);
                      }
                    }
              }
            />
          ))}
        </div>
      ) : (
        <p className="tag-library-empty">
          {readOnly
            ? "Nenhuma tag cadastrada."
            : "Crie tags para organizar suas tarefas."}
        </p>
      )}
    </section>
  );
}


