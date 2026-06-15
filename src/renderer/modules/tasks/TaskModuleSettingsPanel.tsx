import type { TaskTag } from "../../../shared/contracts";
import { TaskTagsPanel } from "./components/TaskTagsPanel";
import type { TaskModuleSettings } from "./types";

export function TaskModuleSettingsPanel({
  settings,
  tags,
  tagError,
  onChange,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
}: {
  settings: TaskModuleSettings;
  tags: TaskTag[];
  tagError: string | null;
  onChange: (settings: TaskModuleSettings) => void;
  onCreateTag: (name: string, color: string) => void;
  onUpdateTag: (id: number, name: string, color: string) => void;
  onDeleteTag: (id: number) => void;
}) {
  return (
    <>
      <section className="setting-group">
        <h3>Lista diaria</h3>
        <p className="muted">
          Preferencias visuais e de ordenacao desta instancia do modulo.
        </p>
      </section>
      <section className="setting-group module-setting-list">
        {[
          ["pendingFirst", "Pendentes primeiro"],
          ["showProgress", "Exibir progresso"],
        ].map(([key, label]) => (
          <label key={key}>
            <span>{label}</span>
            <input
              type="checkbox"
              checked={settings[key as keyof TaskModuleSettings]}
              onChange={(event) =>
                onChange({
                  ...settings,
                  [key]: event.target.checked,
                })
              }
            />
          </label>
        ))}
      </section>
      <section className="setting-group">
        <h3>Tags</h3>
        <p className="muted">
          Crie e gerencie tags para organizar suas tarefas.
        </p>
        {tagError && <p className="settings-inline-error">{tagError}</p>}
        <TaskTagsPanel
          tags={tags}
          readOnly={false}
          compact
          onCreate={onCreateTag}
          onUpdate={onUpdateTag}
          onDelete={onDeleteTag}
        />
      </section>
    </>
  );
}


