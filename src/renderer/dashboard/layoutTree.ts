import type { ModuleId, ModuleLayout } from "./ModuleCard";

export type SplitDirection = "row" | "column";
export type DropPlacement = "left" | "right" | "top" | "bottom";

export type LayoutNode =
  | { type: "module"; id: ModuleId }
  | {
      type: "split";
      direction: SplitDirection;
      ratio: number;
      first: LayoutNode;
      second: LayoutNode;
    };

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutDivider {
  path: string;
  direction: SplitDirection;
  parent: LayoutRect;
  position: number;
}

const normalizeLegacyModuleId = (id: string): ModuleId | null => {
  if (id === "spotify") return "media";
  if (id === "youtube") return null;
  return ["tasks", "weather", "media", "system", "shortcuts"].includes(id)
    ? (id as ModuleId)
    : null;
};

export const migrateLegacyLayoutModules = (
  node: LayoutNode | null,
): LayoutNode | null => {
  if (!node) return null;
  if (node.type === "module") {
    const id = normalizeLegacyModuleId(node.id);
    return id ? { type: "module", id } : null;
  }
  const first = migrateLegacyLayoutModules(node.first);
  const second = migrateLegacyLayoutModules(node.second);
  if (!first) return second;
  if (!second) return first;
  return { ...node, first, second };
};

export const collectModulesInLayout = (node: LayoutNode | null): ModuleId[] => {
  if (!node) return [];
  if (node.type === "module") return [node.id];
  return [
    ...collectModulesInLayout(node.first),
    ...collectModulesInLayout(node.second),
  ];
};

/** Limites proporcionais ao arrastar divisores da grid. */
export const GRID_MIN_ROW_RATIO = 0.2;
export const GRID_MIN_COLUMN_RATIO = 0.1;
export const GRID_MIN_VIEWPORT_HEIGHT = 480;
export const WEATHER_LAYOUT_MAX_RATIO = 0.45;

export const createInitialLayoutTree = (): LayoutNode => ({
  type: "split",
  direction: "row",
  ratio: 0.3,
  first: { type: "module", id: "tasks" },
  second: {
    type: "split",
    direction: "column",
    ratio: WEATHER_LAYOUT_MAX_RATIO,
    first: { type: "module", id: "weather" },
    second: {
      type: "split",
      direction: "row",
      ratio: 0.24,
      first: { type: "module", id: "system" },
      second: { type: "module", id: "media" },
    },
  },
});

const clampRatio = (direction: SplitDirection, ratio: number) => {
  const minimum =
    direction === "column" ? GRID_MIN_COLUMN_RATIO : GRID_MIN_ROW_RATIO;
  return Math.min(1 - minimum, Math.max(minimum, ratio));
};

export const calculateLayout = (
  node: LayoutNode | null,
  bounds: LayoutRect,
  path = "root",
): { modules: ModuleLayout[]; dividers: LayoutDivider[] } => {
  if (!node) return { modules: [], dividers: [] };
  if (node.type === "module") {
    return {
      modules: [{ id: node.id, ...bounds }],
      dividers: [],
    };
  }

  const firstSize =
    node.direction === "row"
      ? bounds.width * node.ratio
      : bounds.height * node.ratio;
  const firstBounds: LayoutRect =
    node.direction === "row"
      ? { ...bounds, width: firstSize }
      : { ...bounds, height: firstSize };
  const secondBounds: LayoutRect =
    node.direction === "row"
      ? {
          x: bounds.x + firstSize,
          y: bounds.y,
          width: bounds.width - firstSize,
          height: bounds.height,
        }
      : {
          x: bounds.x,
          y: bounds.y + firstSize,
          width: bounds.width,
          height: bounds.height - firstSize,
        };
  const first = calculateLayout(node.first, firstBounds, `${path}.first`);
  const second = calculateLayout(node.second, secondBounds, `${path}.second`);

  return {
    modules: [...first.modules, ...second.modules],
    dividers: [
      ...first.dividers,
      ...second.dividers,
      {
        path,
        direction: node.direction,
        parent: bounds,
        position:
          node.direction === "row"
            ? bounds.x + firstSize
            : bounds.y + firstSize,
      },
    ],
  };
};

export const removeModule = (
  node: LayoutNode | null,
  id: ModuleId,
): LayoutNode | null => {
  if (!node) return null;
  if (node.type === "module") return node.id === id ? null : node;

  const first = removeModule(node.first, id);
  const second = removeModule(node.second, id);
  if (!first) return second;
  if (!second) return first;
  return { ...node, first, second };
};

const insertAtTarget = (
  node: LayoutNode,
  source: ModuleId,
  target: ModuleId,
  placement: DropPlacement,
): LayoutNode => {
  if (node.type === "module") {
    if (node.id !== target) return node;
    const incoming: LayoutNode = { type: "module", id: source };
    const direction: SplitDirection =
      placement === "left" || placement === "right" ? "row" : "column";
    const incomingFirst = placement === "left" || placement === "top";
    return {
      type: "split",
      direction,
      ratio: 0.5,
      first: incomingFirst ? incoming : node,
      second: incomingFirst ? node : incoming,
    };
  }
  return {
    ...node,
    first: insertAtTarget(node.first, source, target, placement),
    second: insertAtTarget(node.second, source, target, placement),
  };
};

export const placeModule = (
  root: LayoutNode,
  source: ModuleId,
  target: ModuleId,
  placement: DropPlacement,
): LayoutNode => {
  const withoutSource = removeModule(root, source);
  if (!withoutSource) return root;
  return insertAtTarget(withoutSource, source, target, placement);
};

export const appendModule = (
  root: LayoutNode | null,
  id: ModuleId,
): LayoutNode => {
  const incoming: LayoutNode = { type: "module", id };
  if (!root) return incoming;
  return {
    type: "split",
    direction: "row",
    ratio: 0.7,
    first: root,
    second: incoming,
  };
};

export const updateSplitRatio = (
  node: LayoutNode,
  path: string,
  ratio: number,
  currentPath = "root",
): LayoutNode => {
  if (node.type === "module") return node;
  if (currentPath === path) {
    return { ...node, ratio: clampRatio(node.direction, ratio) };
  }
  return {
    ...node,
    first: updateSplitRatio(node.first, path, ratio, `${currentPath}.first`),
    second: updateSplitRatio(node.second, path, ratio, `${currentPath}.second`),
  };
};
