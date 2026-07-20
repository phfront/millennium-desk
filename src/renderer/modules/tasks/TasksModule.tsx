import { AnimatePresence, motion } from "motion/react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { TaskItem, TaskTag } from "../../../shared/contracts";
import { DatePicker } from "../../components/DatePicker";
import {
  formatDateKey,
  fromDateKey,
  shiftDateKey,
  toDateKey,
} from "../../utils/date";
import { TaskTagPicker } from "./components/TaskTagPicker";
import { TaskTagPill } from "./components/TaskTagPill";
import { TaskTextEditor } from "./components/TaskTextEditor";
import {
  applyTagSuggestionToText,
  findTagSuggestion,
  toggleTagId,
} from "./tagUtils";
import type { TaskModuleSettings } from "./types";

export const TasksModule = memo(function TasksModule({
  settings,
  tags,
  onConfigure,
}: {
  settings: TaskModuleSettings;
  tags: TaskTag[];
  onConfigure: () => void;
}) {
  const today = toDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskCursor, setNewTaskCursor] = useState(0);
  const [newTaskTagIds, setNewTaskTagIds] = useState<number[]>([]);
  const [newTaskPersistent, setNewTaskPersistent] = useState(false);
  const [visibleTagIds, setVisibleTagIds] = useState<number[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editingList, setEditingList] = useState(false);
  const [movingTask, setMovingTask] = useState<{
    item: TaskItem;
    date: string;
  } | null>(null);
  const [items, setItems] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const newTaskInputRef = useRef<HTMLInputElement>(null);
  const tagsById = new Map(tags.map((tag) => [tag.id, tag]));
  const isPast = selectedDate < today;
  const isToday = selectedDate === today;
  const filteredItems = items.filter(
    (item) =>
      item.tagIds.length === 0 ||
      item.tagIds.some((tagId) => visibleTagIds.includes(tagId)),
  );
  // Recorrentes sempre fecham a lista; pendingFirst ordena dentro dos grupos.
  const sortPendingFirst = (group: TaskItem[]) =>
    settings.pendingFirst
      ? [...group].sort((a, b) => Number(a.done) - Number(b.done))
      : group;
  const datedItems = sortPendingFirst(
    filteredItems.filter((item) => !item.persistent),
  );
  const persistentItems = sortPendingFirst(
    filteredItems.filter((item) => item.persistent),
  );
  const visibleItems = [...datedItems, ...persistentItems];
  // Cada opcao de densidade e um modificador isolado no .task-list.
  const densityClassName = [
    "task-list",
    settings.inlineTags && "is-inline-tags",
    settings.denseRows && "is-dense",
    settings.flatList && "is-flat",
    settings.truncateText && "is-truncated",
    settings.compactHeaders && "is-compact-headers",
    settings.textBelow && "is-stacked",
  ]
    .filter(Boolean)
    .join(" ");
  // Separador antes da primeira recorrente, apenas quando os dois grupos existem.
  const persistentDividerId =
    datedItems.length > 0 && persistentItems.length > 0
      ? persistentItems[0].id
      : null;
  const completedCount = items.filter((item) => item.done).length;
  const progressPercent = items.length
    ? (completedCount / items.length) * 100
    : 0;

  useEffect(() => {
    const validTagIds = new Set(tags.map((tag) => tag.id));
    setNewTaskTagIds((current) => current.filter((id) => validTagIds.has(id)));
    setVisibleTagIds((current) => [
      ...current.filter((id) => validTagIds.has(id)),
      ...tags
        .map((tag) => tag.id)
        .filter((id) => !current.includes(id)),
    ]);
    setItems((current) =>
      current.map((item) => ({
        ...item,
        tagIds: item.tagIds.filter((id) => validTagIds.has(id)),
      })),
    );
  }, [tags]);

  useEffect(() => {
    let cancelled = false;

    const loadTasks = async () => {
      setLoading(true);
      setError(null);
      try {
        const nextItems =
          await window.electronControl.tasks.listByDate(selectedDate);
        if (!cancelled) setItems(nextItems);
      } catch (loadError) {
        if (!cancelled) {
          setItems([]);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Falha ao carregar tarefas.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadTasks();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const toggleTaskDone = (item: TaskItem) => {
    void runTaskMutation(async () => {
      const updated = await window.electronControl.tasks.update({
        id: item.id,
        done: !item.done,
      });
      return items.map((entry) => (entry.id === item.id ? updated : entry));
    }, "Falha ao atualizar tarefa.");
  };

  const runTaskMutation = async (
    action: () => Promise<TaskItem[] | void>,
    fallbackMessage: string,
  ) => {
    if (isPast) return;
    setError(null);
    try {
      const nextItems = await action();
      if (Array.isArray(nextItems)) {
        setItems(nextItems);
      } else {
        const refreshed =
          await window.electronControl.tasks.listByDate(selectedDate);
        setItems(refreshed);
      }
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : fallbackMessage,
      );
    }
  };

  const tagSuggestion = useMemo(
    () =>
      findTagSuggestion(newTaskText, newTaskCursor, tags, newTaskTagIds),
    [newTaskText, newTaskCursor, tags, newTaskTagIds],
  );

  const syncNewTaskCursor = (input: HTMLInputElement) => {
    setNewTaskCursor(input.selectionStart ?? input.value.length);
  };

  const applyTagSuggestion = () => {
    if (!tagSuggestion) return;
    const { tag, tokenStart, tokenEnd } = tagSuggestion;
    const nextText = applyTagSuggestionToText(
      newTaskText,
      tokenStart,
      tokenEnd,
    );
    setNewTaskText(nextText);
    setNewTaskTagIds((current) =>
      current.includes(tag.id) ? current : [...current, tag.id],
    );
    requestAnimationFrame(() => {
      const input = newTaskInputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(tokenStart, tokenStart);
      setNewTaskCursor(tokenStart);
    });
  };

  const addTask = () => {
    const text = newTaskText.trim();
    if (!text || isPast) return;
    void runTaskMutation(async () => {
      const created = await window.electronControl.tasks.create({
        date: selectedDate,
        text,
        tagIds: newTaskTagIds,
        persistent: newTaskPersistent,
      });
      setNewTaskText("");
      setNewTaskCursor(0);
      setNewTaskTagIds([]);
      setNewTaskPersistent(false);
      return [...items, created];
    }, "Falha ao criar tarefa.");
  };

  const toggleTaskPersistent = (item: TaskItem) => {
    void runTaskMutation(async () => {
      const updated = await window.electronControl.tasks.update({
        id: item.id,
        persistent: !item.persistent,
        // Ao voltar a ser datada, a tarefa passa a pertencer ao dia em vista.
        ...(item.persistent ? { date: selectedDate } : {}),
      });
      return items.map((entry) => (entry.id === item.id ? updated : entry));
    }, "Falha ao alterar recorrencia da tarefa.");
  };

  const moveTaskToDate = () => {
    if (!movingTask) return;
    void runTaskMutation(async () => {
      const updated = await window.electronControl.tasks.update({
        id: movingTask.item.id,
        date: movingTask.date,
      });
      setMovingTask(null);
      if (movingTask.date !== selectedDate) {
        return items.filter((entry) => entry.id !== movingTask.item.id);
      }
      return items.map((entry) =>
        entry.id === movingTask.item.id ? updated : entry,
      );
    }, "Falha ao mover tarefa.");
  };

  useEffect(() => {
    setEditingList(false);
    setMovingTask(null);
    setNewTaskText("");
    setNewTaskCursor(0);
    setNewTaskTagIds([]);
    setNewTaskPersistent(false);
  }, [selectedDate]);

  useEffect(() => {
    if (editingList) {
      requestAnimationFrame(() => newTaskInputRef.current?.focus());
    }
  }, [editingList]);

  useEffect(() => {
    if (!filtersOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest("[data-task-filter-menu]")) {
        setFiltersOpen(false);
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [filtersOpen]);

  return (
    <div className="module-content tasks-module">
      <div className="module-heading">
        <div>
          <span className="eyebrow">Todoist</span>
          <h2>
            {isToday
              ? "Tarefas de hoje"
              : isPast
                ? "Historico"
                : "Planejamento futuro"}
          </h2>
        </div>
        <div className="module-actions">
          <span className="counter">
            {items.filter((item) => !item.done).length} pendentes
          </span>
          <button
            className="module-action-icon module-config-button"
            aria-label="Configurar tarefas"
            title="Configurar"
            onClick={onConfigure}
          />
        </div>
      </div>
      <div className="module-body">
        <div className="date-navigation">
          <DatePicker
            aria-label="Selecionar data"
            value={selectedDate}
            clearable={false}
            onChange={setSelectedDate}
          />
          <div className="date-navigation-actions">
            {!isPast && (
              <button
                className={
                  editingList
                    ? "module-action-icon list-edit-button active"
                    : "module-action-icon list-edit-button"
                }
                aria-label={
                  editingList ? "Concluir edicao da lista" : "Editar lista"
                }
                title={editingList ? "Concluir edicao" : "Editar lista"}
                onClick={() => setEditingList((value) => !value)}
              />
            )}
            <div className="date-navigation-filter" data-task-filter-menu>
              <button
                className={
                  filtersOpen ? "task-filter-button active" : "task-filter-button"
                }
                type="button"
                aria-label="Abrir filtros"
                aria-expanded={filtersOpen}
                title="Filtros"
                onClick={() => setFiltersOpen((value) => !value)}
              />
              {filtersOpen && tags.length > 0 && (
                <div className="task-filter-dropdown" role="menu">
                  <div className="task-filter-dropdown-header">Tags</div>
                  <div className="tag-toggle-list">
                    {tags.map((tag) => {
                      const selected = visibleTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          role="menuitemcheckbox"
                          aria-checked={selected}
                          className={
                            selected ? "tag-toggle selected" : "tag-toggle"
                          }
                          style={
                            selected
                              ? {
                                  color: tag.color,
                                  backgroundColor: `${tag.color}22`,
                                  borderColor: `${tag.color}66`,
                                }
                              : undefined
                          }
                          onClick={() =>
                            setVisibleTagIds((current) =>
                              toggleTagId(current, tag.id),
                            )
                          }
                        >
                          <span
                            className="tag-swatch"
                            style={{ backgroundColor: tag.color }}
                          />
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {error && <div className="date-status">{error}</div>}
        {settings.showProgress && progressPercent > 0 && (
          <div className="progress">
            <motion.span animate={{ width: `${progressPercent}%` }} />
          </div>
        )}
        <div className={densityClassName}>
          {loading && <div className="empty-tasks">Carregando tarefas...</div>}
          <AnimatePresence initial={false}>
            {!loading &&
              visibleItems.flatMap((item) => {
                const taskNode = (
              <motion.div
                layout
                key={item.id}
                className={[
                  "task",
                  item.done && "done",
                  !editingList && !isPast && "task-toggleable",
                ]
                  .filter(Boolean)
                  .join(" ")}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                onClick={() => {
                  if (!editingList && !isPast) toggleTaskDone(item);
                }}
              >
                <div className="task-main">
                  <button
                    className="task-toggle"
                    disabled={isPast}
                    aria-label={item.done ? "Desmarcar tarefa" : "Marcar tarefa"}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!isPast) toggleTaskDone(item);
                    }}
                  >
                  </button>
                  <div className="task-body">
                    <TaskTextEditor
                      item={item}
                      readOnly={isPast || !editingList}
                      onSave={(id, text) => {
                        void runTaskMutation(async () => {
                          const updated = await window.electronControl.tasks.update({
                            id,
                            text,
                          });
                          return items.map((entry) =>
                            entry.id === id ? updated : entry,
                          );
                        }, "Falha ao renomear tarefa.");
                      }}
                    />
                  </div>
                </div>
                <div className="task-tags-row">
                  {item.persistent &&
                    (!isPast && editingList ? (
                      <button
                        type="button"
                        className="task-persistent-pill"
                        aria-label="Transformar em tarefa com data"
                        title="Voltar a ter data (fica no dia em exibição)"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleTaskPersistent(item);
                        }}
                      >
                        ∞
                      </button>
                    ) : (
                      <span
                        className="task-persistent-pill"
                        aria-label="Recorrente"
                        title="Recorrente: aparece todos os dias até ser concluída"
                      >
                        ∞
                      </span>
                    ))}
                  {item.tagIds.map((tagId) => {
                    const tag = tagsById.get(tagId);
                    if (!tag) return null;
                    return <TaskTagPill key={tag.id} tag={tag} />;
                  })}
                  {editingList && (
                    <TaskTagPicker
                      tags={tags}
                      selectedIds={item.tagIds}
                      disabled={isPast}
                      onChange={(tagIds) => {
                        void runTaskMutation(async () => {
                          const updated = await window.electronControl.tasks.update({
                            id: item.id,
                            tagIds,
                          });
                          return items.map((entry) =>
                            entry.id === item.id ? updated : entry,
                          );
                        }, "Falha ao atualizar tags da tarefa.");
                      }}
                    />
                  )}
                </div>
                {!isPast && editingList && (
                  <>
                    {!item.persistent && (
                      <button
                        className="task-persistent-toggle"
                        aria-label="Transformar em recorrente"
                        title="Recorrente: aparece todos os dias até concluir"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleTaskPersistent(item);
                        }}
                      >
                        ∞
                      </button>
                    )}
                    {!item.persistent && (
                      <button
                        className="task-move"
                        aria-label="Mover tarefa para outro dia"
                        title="Mover para outro dia"
                        onClick={(event) => {
                          event.stopPropagation();
                          setMovingTask({
                            item,
                            date: shiftDateKey(selectedDate, 1),
                          });
                        }}
                      />
                    )}
                    <button
                      className="task-delete"
                      aria-label="Excluir tarefa"
                      title="Excluir tarefa"
                      onClick={(event) => {
                        event.stopPropagation();
                        void runTaskMutation(async () => {
                          await window.electronControl.tasks.delete(item.id);
                          return items.filter((entry) => entry.id !== item.id);
                        }, "Falha ao excluir tarefa.");
                      }}
                  >
                    🗑
                  </button>
                  </>
                )}
              </motion.div>
                );
                if (item.id !== persistentDividerId) return [taskNode];
                return [
                  <motion.div
                    key="task-group-divider"
                    layout
                    className="task-group-divider"
                    role="separator"
                    aria-label="Tarefas recorrentes"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    Recorrentes
                  </motion.div>,
                  taskNode,
                ];
              })}
          </AnimatePresence>
          {!loading && items.length === 0 && (
            <div className="empty-tasks">
              Nenhuma tarefa registrada nesta data.
            </div>
          )}
          {!loading && items.length > 0 && visibleItems.length === 0 && (
            <div className="empty-tasks">
              Nenhuma tarefa corresponde aos filtros selecionados.
            </div>
          )}
        </div>
        {!isPast && editingList && (
          <div className="task-composer-block">
            <div className="task-composer">
              <div className="task-composer-input-wrap">
                <input
                  ref={newTaskInputRef}
                  value={newTaskText}
                  placeholder={
                    newTaskPersistent
                      ? "Adicionar tarefa recorrente (todo dia até concluir)"
                      : isToday
                        ? "Adicionar atividade de hoje"
                        : "Planejar atividade futura"
                  }
                  aria-autocomplete="list"
                  aria-controls={
                    tagSuggestion ? "task-tag-suggestion" : undefined
                  }
                  onChange={(event) => {
                    setNewTaskText(event.target.value);
                    syncNewTaskCursor(event.target);
                  }}
                  onSelect={(event) => syncNewTaskCursor(event.currentTarget)}
                  onKeyUp={(event) => syncNewTaskCursor(event.currentTarget)}
                  onClick={(event) => syncNewTaskCursor(event.currentTarget)}
                  onPointerDown={(event) => event.currentTarget.focus()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && tagSuggestion) {
                      event.preventDefault();
                      applyTagSuggestion();
                      return;
                    }
                    if (event.key === "Enter") addTask();
                  }}
                />
                {tagSuggestion && (
                  <div
                    id="task-tag-suggestion"
                    className="task-tag-suggestion"
                    role="status"
                  >
                    <span className="task-tag-suggestion-label">
                      Inserir tag
                    </span>
                    <TaskTagPill tag={tagSuggestion.tag} />
                    <span className="task-tag-suggestion-hint">Enter</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                className={
                  newTaskPersistent
                    ? "task-composer-persistent active"
                    : "task-composer-persistent"
                }
                aria-pressed={newTaskPersistent}
                aria-label="Criar como tarefa recorrente"
                title="Recorrente: sem data, aparece todos os dias até ser concluída"
                onClick={() => setNewTaskPersistent((value) => !value)}
              >
                ∞
              </button>
              <button
                className="add-task"
                aria-label="Adicionar tarefa"
                title="Adicionar tarefa"
                onClick={addTask}
              >
                +
              </button>
            </div>
            {tags.length > 0 && (
              <div className="task-composer-tags">
                <span>Tags da nova tarefa</span>
                <div className="tag-toggle-list">
                  {tags.map((tag) => {
                    const selected = newTaskTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        className={
                          selected ? "tag-toggle selected" : "tag-toggle"
                        }
                        style={
                          selected
                            ? {
                                color: tag.color,
                                backgroundColor: `${tag.color}22`,
                                borderColor: `${tag.color}66`,
                              }
                            : undefined
                        }
                        onClick={() =>
                          setNewTaskTagIds((current) =>
                            toggleTagId(current, tag.id),
                          )
                        }
                      >
                        <span
                          className="tag-swatch"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <AnimatePresence>
        {movingTask && (
          <motion.div
            className="task-move-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Mover tarefa para outro dia"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              className="task-move-backdrop"
              type="button"
              aria-label="Cancelar mover tarefa"
              onClick={() => setMovingTask(null)}
            />
            <motion.div
              className="task-move-dialog"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
            >
              <div className="task-move-heading">
                <span>Mover tarefa</span>
                <strong>{movingTask.item.text}</strong>
              </div>
              <DatePicker
                aria-label="Selecionar nova data da tarefa"
                value={movingTask.date}
                clearable={false}
                defaultOpen
                onChange={(date) =>
                  setMovingTask((current) =>
                    current ? { ...current, date } : current,
                  )
                }
              />
              <div className="task-move-summary">
                Nova data: {formatDateKey(movingTask.date)}
              </div>
              <div className="task-move-actions">
                <button type="button" onClick={() => setMovingTask(null)}>
                  Cancelar
                </button>
                <button type="button" onClick={moveTaskToDate}>
                  Mover
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
