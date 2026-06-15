import { useEffect, useRef, useState } from "react";
import type { TaskItem } from "../../../../shared/contracts";

export function TaskTextEditor({
  item,
  readOnly,
  onSave,
}: {
  item: TaskItem;
  readOnly: boolean;
  onSave: (id: number, text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(item.text);
    setEditing(false);
  }, [item.id, item.text]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const cancelEdit = () => {
    setDraft(item.text);
    setEditing(false);
  };

  const commitEdit = () => {
    const nextText = draft.trim();
    setEditing(false);

    if (!nextText) {
      setDraft(item.text);
      return;
    }

    if (nextText !== item.text) {
      onSave(item.id, nextText);
    }
  };

  if (readOnly) {
    return <span className="task-text">{item.text}</span>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="task-edit-input"
        value={draft}
        aria-label="Editar tarefa"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitEdit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitEdit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            cancelEdit();
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="task-text"
      onClick={() => setEditing(true)}
    >
      {item.text}
    </button>
  );
}


