import { useEffect, useRef, useState } from "react";
import type { TaskTag } from "../../../../shared/contracts";
import { toggleTagId } from "../tagUtils";

export function TaskTagPicker({
  tags,
  selectedIds,
  disabled,
  onChange,
}: {
  tags: TaskTag[];
  selectedIds: number[];
  disabled?: boolean;
  onChange: (tagIds: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  if (tags.length === 0) return null;

  return (
    <div className="task-tag-picker" ref={rootRef}>
      <button
        type="button"
        className="task-tag-picker-trigger"
        disabled={disabled}
        aria-label="Atribuir tags"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Tag
      </button>
      {open && (
        <div className="task-tag-picker-menu" role="menu">
          {tags.map((tag) => {
            const selected = selectedIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={selected}
                className={selected ? "selected" : ""}
                onClick={() => onChange(toggleTagId(selectedIds, tag.id))}
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
      )}
    </div>
  );
}


