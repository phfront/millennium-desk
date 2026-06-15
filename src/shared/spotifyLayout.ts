export type SpotifyLayoutMode = "mobile" | "desktop";

/** Largura abaixo da qual o Spotify web usa layout mobile (barra inferior). */
export const SPOTIFY_MOBILE_MAX_WIDTH = 768;
export const SPOTIFY_DESKTOP_MIN_WIDTH = 820;

export const inferSpotifyLayoutForWidth = (
  width: number,
): SpotifyLayoutMode =>
  width < SPOTIFY_MOBILE_MAX_WIDTH ? "mobile" : "desktop";

export const resolveSpotifyLayoutForWidth = (
  width: number,
  current: SpotifyLayoutMode,
): SpotifyLayoutMode => {
  if (current === "desktop" && width < SPOTIFY_MOBILE_MAX_WIDTH) {
    return "mobile";
  }
  if (current === "mobile" && width >= SPOTIFY_DESKTOP_MIN_WIDTH) {
    return "desktop";
  }
  return current;
};
