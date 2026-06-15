import type { CSSProperties } from "react";

export const DEFAULT_SHORTCUT_COLOR = "#8c8dff";
export const DEFAULT_SHORTCUT_COLOR2 = "#5a67ff";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function normalizeHex(color: string | undefined, fallback: string): string {
  const value = color?.trim() || fallback;
  return HEX_COLOR.test(value) ? value : fallback;
}

function shortcutGradientImage(c1: string, c2: string): string {
  return `radial-gradient(circle, ${c1} 0%, ${c2} 71%)`;
}

export function shortcutTileStyle(
  color?: string,
  color2?: string,
): CSSProperties {
  const c1 = normalizeHex(color, DEFAULT_SHORTCUT_COLOR);
  const c2 = normalizeHex(color2, DEFAULT_SHORTCUT_COLOR2);

  return {
    backgroundColor: c1,
    backgroundImage: shortcutGradientImage(c1, c2),
  };
}
