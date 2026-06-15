import type { TaskTag } from "../../../../shared/contracts";

export function TaskTagPill({
  tag,
  onEdit,
  onRemove,
}: {
  tag: TaskTag;
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  return (
    <span
      className="tag-pill"
      style={{
        color: tag.color,
        backgroundColor: `${tag.color}22`,
        borderColor: `${tag.color}55`,
      }}
    >
      {onEdit ? (
        <button
          type="button"
          className="tag-pill-edit"
          aria-label={`Editar tag ${tag.name}`}
          onClick={onEdit}
        >
          {tag.name}
        </button>
      ) : (
        tag.name
      )}
      {onRemove && (
        <button
          type="button"
          className="tag-pill-remove"
          aria-label={`Remover tag ${tag.name}`}
          onClick={onRemove}
        >
          ×
        </button>
      )}
    </span>
  );
}


