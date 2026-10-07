import type {
  ShelloDisplayMode,
  ShelloGridView,
  ShelloSettings,
} from "./contracts";

// Shello (Claude Web, repo claude-web-term): painel das sessoes do Claude Code. O Desk so
// exibe; as visoes sao construidas la. Ver docs/shello-plano.md.
export const DEFAULT_SHELLO_URL = "http://127.0.0.1:7681";

export const DEFAULT_SHELLO_SETTINGS: ShelloSettings = {
  mode: "grid",
  gridView: "summary",
  url: DEFAULT_SHELLO_URL,
};

/** So servidor deste PC: o token do Shello da acesso total aos terminais. */
export const normalizeShelloUrl = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") return null;
    return url.origin;
  } catch {
    return null;
  }
};

export const isShelloDisplayMode = (value: unknown): value is ShelloDisplayMode =>
  value === "grid" || value === "drawer";

export const isShelloGridView = (value: unknown): value is ShelloGridView =>
  value === "summary" || value === "limits";

export const normalizeShelloSettings = (value: unknown): ShelloSettings => {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<ShelloSettings>;
  return {
    mode: isShelloDisplayMode(raw.mode) ? raw.mode : DEFAULT_SHELLO_SETTINGS.mode,
    gridView: isShelloGridView(raw.gridView)
      ? raw.gridView
      : DEFAULT_SHELLO_SETTINGS.gridView,
    url: normalizeShelloUrl(raw.url) ?? DEFAULT_SHELLO_SETTINGS.url,
  };
};

/** Grade: o Resumo do modo embutido (ou so os limites). Gaveta: o app completo. */
export const shelloViewUrl = (
  base: string,
  mode: ShelloDisplayMode,
  gridView: ShelloGridView,
) =>
  mode === "drawer"
    ? `${base}/`
    : `${base}/?embed#${gridView === "limits" ? "limites-mini" : "resumo"}`;
