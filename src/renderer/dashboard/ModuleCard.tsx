import { AnimatePresence, motion } from "motion/react";
import { useRef } from "react";
import type { CSSProperties, PointerEvent, ReactNode } from "react";
import type {
  DropPlacement,
  LayoutDivider,
} from "./layoutTree";

export type ModuleId =
  | "tasks"
  | "weather"
  | "media"
  | "system"
  | "shortcuts"
  | "claude"
  | "quotes";

const DROP_LABELS: Record<DropPlacement, string> = {
  left: "Encaixar à esquerda",
  right: "Encaixar à direita",
  top: "Encaixar acima",
  bottom: "Encaixar abaixo",
};

const MODULE_EDIT_META: Record<
  ModuleId,
  {
    title: string;
    eyebrow: string;
  }
> = {
  tasks: { eyebrow: "Todoist", title: "Tarefas" },
  weather: { eyebrow: "CLIMA · HORARIO", title: "Ambiente" },
  media: { eyebrow: "SMART TV", title: "Midia" },
  system: { eyebrow: "PERFORMANCE", title: "Sistema" },
  shortcuts: { eyebrow: "ACOES RAPIDAS", title: "Atalhos" },
  claude: { eyebrow: "CLAUDE CODE", title: "Sessoes" },
  quotes: { eyebrow: "MERCADO", title: "Cotacoes" },
};

const getDropIndicatorBounds = (
  placement: DropPlacement,
  width: number,
  height: number,
  inset = 12,
) => {
  const innerWidth = width - inset * 2;
  const innerHeight = height - inset * 2;
  const halfWidth = innerWidth / 2;
  const halfHeight = innerHeight / 2;

  switch (placement) {
    case "left":
      return { left: inset, top: inset, width: halfWidth, height: innerHeight };
    case "right":
      return {
        left: inset + halfWidth,
        top: inset,
        width: halfWidth,
        height: innerHeight,
      };
    case "top":
      return { left: inset, top: inset, width: innerWidth, height: halfHeight };
    case "bottom":
      return {
        left: inset,
        top: inset + halfHeight,
        width: innerWidth,
        height: halfHeight,
      };
  }
};

export interface ModuleLayout {
  id: ModuleId;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function ModuleCard({
  layout,
  editMode,
  reduceMotion,
  draggedModule,
  dropTarget,
  dropPlacement,
  onDragStateChange,
  onPlace,
  onHide,
  onConfigure,
  expanded = false,
  children,
}: {
  layout: ModuleLayout;
  editMode: boolean;
  reduceMotion: boolean;
  draggedModule: ModuleId | null;
  dropTarget: ModuleId | null;
  dropPlacement: DropPlacement | null;
  onDragStateChange: (
    source: ModuleId | null,
    target: ModuleId | null,
    placement: DropPlacement | null,
  ) => void;
  onPlace: (
    source: ModuleId,
    target: ModuleId,
    placement: DropPlacement,
  ) => void;
  onHide: (id: ModuleId) => void;
  onConfigure: (id: ModuleId) => void;
  expanded?: boolean;
  children: ReactNode;
}) {
  const isDragged = draggedModule === layout.id;
  const isDropTarget = dropTarget === layout.id;
  const editMeta = MODULE_EDIT_META[layout.id];
  const getPlacement = (event: PointerEvent) => {
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-module-id]");
    const targetId = target?.dataset.moduleId as ModuleId | undefined;
    if (!target || !targetId || targetId === layout.id) {
      return { targetId: null, placement: null };
    }
    const rect = target.getBoundingClientRect();
    const distances = {
      left: event.clientX - rect.left,
      right: rect.right - event.clientX,
      top: event.clientY - rect.top,
      bottom: rect.bottom - event.clientY,
    };
    const placement = (
      Object.entries(distances) as Array<[DropPlacement, number]>
    ).sort((a, b) => a[1] - b[1])[0][0];
    return { targetId, placement };
  };
  const style = {
    "--module-x": `${layout.x}px`,
    "--module-y": `${layout.y}px`,
    "--module-width": `${layout.width}px`,
    "--module-height": `${layout.height}px`,
  } as CSSProperties;

  return (
    <motion.article
      data-module-id={layout.id}
      className={[
        "module-card",
        editMode ? "editable" : "",
        expanded ? "module-card--expanded" : "",
        isDragged ? "dragging" : "",
        isDropTarget ? "drop-target" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={style}
      layout={!reduceMotion && !editMode}
      animate={{
        scale: isDragged ? 0.985 : isDropTarget ? 0.995 : 1,
      }}
      transition={{
        layout: { duration: 0.02 },
        scale: { duration: 0.1, ease: "easeOut" },
      }}
    >
      <AnimatePresence>
        {isDropTarget && dropPlacement && (
          <motion.div
            key={`drop-${layout.id}`}
            className={[
              "module-drop-indicator",
              reduceMotion ? "module-drop-indicator--static" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-placement={dropPlacement}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
            animate={{
              opacity: 1,
              scale: 1,
              ...getDropIndicatorBounds(
                dropPlacement,
                layout.width,
                layout.height,
              ),
            }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
          >
            <span>{DROP_LABELS[dropPlacement]}</span>
          </motion.div>
        )}
      </AnimatePresence>
      {editMode && (
        <>
          <div className="module-edit-overlay" />
          <div className="module-edit-controls">
            <div className="module-edit-label">
              <span className="module-edit-eyebrow">{editMeta.title}</span>
              <strong className="module-edit-title">{editMeta.eyebrow}</strong>
            </div>
            <div className="module-edit-toolbar">
              <button
                type="button"
                className="module-edit-icon-button module-drag-button"
                aria-label="Arrastar para reorganizar"
                title="Arrastar"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  onDragStateChange(layout.id, null, null);
                }}
                onPointerMove={(event) => {
                  if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                  const next = getPlacement(event);
                  onDragStateChange(layout.id, next.targetId, next.placement);
                }}
                onPointerUp={(event) => {
                  const next = getPlacement(event);
                  if (next.targetId && next.placement) {
                    onPlace(layout.id, next.targetId, next.placement);
                  }
                  onDragStateChange(null, null, null);
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }}
                onPointerCancel={() => onDragStateChange(null, null, null)}
              />
              <button
                type="button"
                className="module-edit-icon-button module-config-edit-button"
                aria-label={`Configurar modulo ${layout.id}`}
                title="Configurar"
                onClick={() => onConfigure(layout.id)}
              />
              <button
                type="button"
                className="module-edit-icon-button module-hide-button"
                aria-label={`Ocultar modulo ${layout.id}`}
                title="Ocultar"
                onClick={() => onHide(layout.id)}
              />
            </div>
          </div>
        </>
      )}
      {children}
    </motion.article>
  );
}

export function GridDivider({
  divider,
  onChange,
}: {
  divider: LayoutDivider;
  onChange: (ratio: number) => void;
}) {
  const activePointer = useRef<number | null>(null);

  return (
    <button
      aria-label={
        divider.direction === "row"
          ? "Redimensionar colunas"
          : "Redimensionar linhas"
      }
      className={`grid-divider ${divider.direction}`}
      style={
        divider.direction === "row"
          ? {
              left: `${divider.position}px`,
              top: `${divider.parent.y}px`,
              height: `${divider.parent.height}px`,
            }
          : {
              top: `${divider.position}px`,
              left: `${divider.parent.x}px`,
              width: `${divider.parent.width}px`,
            }
      }
      onPointerDown={(event) => {
        event.preventDefault();
        activePointer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (activePointer.current !== event.pointerId) return;
        const ratio =
          divider.direction === "row"
            ? (event.clientX - divider.parent.x) / divider.parent.width
            : (event.clientY - divider.parent.y) / divider.parent.height;
        onChange(ratio);
      }}
      onPointerUp={(event) => {
        if (activePointer.current !== event.pointerId) return;
        activePointer.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        activePointer.current = null;
      }}
    >
      <span />
    </button>
  );
}
