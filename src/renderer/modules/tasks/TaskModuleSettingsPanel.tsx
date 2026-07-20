import type { TaskTag } from "../../../shared/contracts";
import { TaskTagsPanel } from "./components/TaskTagsPanel";
import type { TaskModuleSettings } from "./types";

type ToggleKey = keyof TaskModuleSettings;

const ORDERING_TOGGLES: [ToggleKey, string][] = [
  ["pendingFirst", "Pendentes primeiro"],
  ["showProgress", "Exibir progresso"],
];

const DENSITY_TOGGLES: [ToggleKey, string, string][] = [
  ["inlineTags", "Tag na linha", "Libera a largura reservada no canto"],
  ["denseRows", "Linha compacta", "Altura menor e recuo igual nos quatro lados"],
  ["flatList", "Lista continua", "Separadores no lugar de um cartao por tarefa"],
  ["truncateText", "Texto em uma linha", "Corta com reticencias; o texto inteiro fica no title"],
  ["compactHeaders", "Divisor compacto", "Grupo sem a regua ocupando altura"],
  ["textBelow", "Texto embaixo da tag", "Segunda linha em largura total; custa altura"],
];

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
        {ORDERING_TOGGLES.map(([key, label]) => (
          <label key={key}>
            <span>{label}</span>
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(event) =>
                onChange({ ...settings, [key]: event.target.checked })
              }
            />
          </label>
        ))}
      </section>
      <section className="setting-group">
        <h3>Densidade da lista</h3>
        <p className="muted">
          Cada opcao encolhe a lista de um jeito. Ligue as que fizerem sentido.
        </p>
      </section>
      <section className="setting-group module-setting-list module-setting-list-stacked">
        {DENSITY_TOGGLES.map(([key, label, hint]) => (
          <label key={key}>
            <span>
              {label}
              <small>{hint}</small>
            </span>
            <input
              type="checkbox"
              checked={settings[key]}
              onChange={(event) =>
                onChange({ ...settings, [key]: event.target.checked })
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


