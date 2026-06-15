export type MediaAppId =
  | "youtube"
  | "spotify"
  | "netflix"
  | "prime"
  | "disney"
  | "hbomax"
  | "twitch"
  | "globoplay";

export interface MediaAppInfo {
  id: MediaAppId;
  label: string;
  accent: string;
  shortLabel: string;
}

export interface MediaAppDefinition extends MediaAppInfo {
  homeUrl: string;
  partition: string;
  trustedDomains: string[];
  /** Mascara o UA como Chrome (obrigatorio para DRM em Netflix, Disney+, etc.). */
  useChromeIdentity?: boolean;
}

export const DEFAULT_MEDIA_APP_ID: MediaAppId = "youtube";

export const MEDIA_APP_DEFINITIONS: MediaAppDefinition[] = [
  {
    id: "youtube",
    label: "YouTube",
    shortLabel: "YT",
    accent: "#1a1a1a",
    homeUrl: "https://www.youtube.com/",
    partition: "persist:media-youtube",
    trustedDomains: [
      "youtube.com",
      "google.com",
      "googleusercontent.com",
      "gstatic.com",
      "ytimg.com",
    ],
  },
  {
    id: "spotify",
    label: "Spotify",
    shortLabel: "SP",
    accent: "#169c46",
    homeUrl: "https://open.spotify.com/",
    partition: "persist:spotify",
    useChromeIdentity: true,
    trustedDomains: [
      "spotify.com",
      "spotifycdn.com",
      "scdn.co",
      "spotify.net",
      "google.com",
      "googleusercontent.com",
      "gstatic.com",
      "apple.com",
      "facebook.com",
      "cloudflare.com",
    ],
  },
  {
    id: "netflix",
    label: "Netflix",
    shortLabel: "NF",
    accent: "#1a1a1a",
    homeUrl: "https://www.netflix.com/",
    useChromeIdentity: true,
    partition: "persist:media-netflix",
    trustedDomains: [
      "netflix.com",
      "nflxext.com",
      "nflximg.net",
      "nflxso.net",
      "nflxvideo.net",
    ],
  },
  {
    id: "prime",
    label: "Prime Video",
    shortLabel: "PV",
    accent: "#00a8e1",
    homeUrl: "https://www.primevideo.com/",
    useChromeIdentity: true,
    partition: "persist:media-prime",
    trustedDomains: [
      "primevideo.com",
      "amazon.com",
      "amazon.com.br",
      "media-amazon.com",
      "aiv-cdn.net",
      "cloudfront.net",
      "ssl-images-amazon.com",
      "google.com",
      "googleusercontent.com",
    ],
  },
  {
    id: "disney",
    label: "Disney+",
    shortLabel: "D+",
    accent: "#113ccf",
    homeUrl: "https://www.disneyplus.com/",
    useChromeIdentity: true,
    partition: "persist:media-disney",
    trustedDomains: [
      "disneyplus.com",
      "disney.com",
      "bamgrid.com",
      "dssott.com",
    ],
  },
  {
    id: "hbomax",
    label: "HBO Max",
    shortLabel: "HB",
    accent: "#5b0bf2",
    homeUrl: "https://play.max.com/",
    useChromeIdentity: true,
    partition: "persist:media-hbomax",
    trustedDomains: [
      "max.com",
      "hbomax.com",
      "hbo.com",
      "warnermediacdn.com",
      "wbd.com",
      "brightline.tv",
      "google.com",
      "googleusercontent.com",
    ],
  },
  {
    id: "twitch",
    label: "Twitch",
    shortLabel: "TW",
    accent: "#9146ff",
    homeUrl: "https://www.twitch.tv/",
    partition: "persist:media-twitch",
    trustedDomains: ["twitch.tv", "ttvnw.net", "jtvnw.net", "twitchcdn.net"],
  },
  {
    id: "globoplay",
    label: "Globoplay",
    shortLabel: "GP",
    accent: "#1a1a1a",
    homeUrl: "https://globoplay.globo.com/",
    partition: "persist:media-globoplay",
    trustedDomains: ["globo.com", "globoplay.globo.com", "glbimg.com"],
  },
];

export const MEDIA_APPS: MediaAppInfo[] = MEDIA_APP_DEFINITIONS.map(
  ({ id, label, accent, shortLabel }) => ({ id, label, accent, shortLabel }),
);

export const getMediaAppDefinition = (id: MediaAppId) => {
  const definition = MEDIA_APP_DEFINITIONS.find((app) => app.id === id);
  if (!definition) throw new Error(`App de midia desconhecido: ${id}`);
  return definition;
};

export const isMediaAppId = (value: unknown): value is MediaAppId =>
  MEDIA_APP_DEFINITIONS.some((app) => app.id === value);

export const getVisibleMediaApps = (hiddenAppIds: readonly MediaAppId[]) => {
  const hidden = new Set(hiddenAppIds);
  return MEDIA_APPS.filter((app) => !hidden.has(app.id));
};

export const resolveActiveMediaApp = (
  activeAppId: MediaAppId,
  hiddenAppIds: readonly MediaAppId[],
): MediaAppId => {
  const visible = getVisibleMediaApps(hiddenAppIds);
  if (visible.length === 0) return activeAppId;
  if (!hiddenAppIds.includes(activeAppId)) return activeAppId;
  return visible[0].id;
};
