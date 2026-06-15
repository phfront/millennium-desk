import { app, ipcMain, session, shell, WebContentsView } from "electron";
import fs from "node:fs";
import path from "node:path";
import {
  applySpotifyLayoutMode,
  captureEmbeddedWebPreview,
  createEmbeddedWebView,
  createSpotifyIdentityController,
  disposeEmbeddedWebView,
  getEmbeddedWebHomeUrl,
  getFrontEmbeddedWebView,
  parkEmbeddedWebView,
  setEmbeddedWebViewVisible,
  syncEmbeddedWebViewBounds,
  type SpotifyIdentityController,
} from "./embeddedWeb";
import { getSpotifyPlaybackSupport } from "./widevineComponents";
import { getSettings } from "./settings/store";
import {
  DEFAULT_MEDIA_APP_ID,
  getMediaAppDefinition,
  isMediaAppId,
  MEDIA_APP_DEFINITIONS,
  MEDIA_APPS,
  type MediaAppDefinition,
  type MediaAppId,
} from "../shared/mediaApps";
import type { ViewBounds } from "../shared/contracts";

type MediaHubContext = {
  getMainWindow: () => Electron.BrowserWindow | null;
  onBeforeInputEvent?: (
    event: Electron.Event,
    input: Electron.Input,
  ) => void;
};

type MediaAppRuntime = {
  view: WebContentsView;
  spotifyIdentity?: SpotifyIdentityController;
};

let context: MediaHubContext | null = null;
let hubVisible = false;
let activeAppId: MediaAppId = DEFAULT_MEDIA_APP_ID;
let slotBounds: Electron.Rectangle | null = null;
const runtimes = new Map<MediaAppId, MediaAppRuntime>();
const savedMediaUrls = new Map<MediaAppId, string>();
const warmTimers = new Set<ReturnType<typeof setTimeout>>();

const clearWarmTimers = () => {
  for (const timer of warmTimers) clearTimeout(timer);
  warmTimers.clear();
};

const getHiddenMediaAppIds = () => {
  const hidden = getSettings().hiddenMediaAppIds;
  return hidden.filter((appId) => isMediaAppId(appId));
};

const normalizeBounds = (bounds: ViewBounds): Electron.Rectangle => ({
  x: Math.max(0, Math.round(bounds.x)),
  y: Math.max(0, Math.round(bounds.y)),
  width: Math.max(1, Math.round(bounds.width)),
  height: Math.max(1, Math.round(bounds.height)),
});

const createTrustedNavigationCheck =
  (domains: string[]) =>
  (rawUrl: string) => {
    try {
      const url = new URL(rawUrl);
      if (url.protocol !== "https:") return false;
      return domains.some(
        (domain) =>
          url.hostname === domain || url.hostname.endsWith(`.${domain}`),
      );
    } catch {
      return false;
    }
  };

const rememberMediaUrl = (appId: MediaAppId, runtime: MediaAppRuntime) => {
  if (runtime.view.webContents.isDestroyed()) return;

  const currentUrl = runtime.view.webContents.getURL();
  if (!currentUrl || currentUrl.startsWith("about:")) return;

  const definition = getMediaAppDefinition(appId);
  if (!createTrustedNavigationCheck(definition.trustedDomains)(currentUrl)) {
    return;
  }

  savedMediaUrls.set(appId, currentUrl);
};

const resolveResumeUrl = (
  appId: MediaAppId,
  definition: MediaAppDefinition,
  spotifyIdentity?: SpotifyIdentityController,
) => {
  const savedUrl = savedMediaUrls.get(appId);
  if (
    savedUrl &&
    createTrustedNavigationCheck(definition.trustedDomains)(savedUrl)
  ) {
    return savedUrl;
  }

  if (appId === "spotify" && spotifyIdentity) {
    return getEmbeddedWebHomeUrl("spotify", spotifyIdentity.getLayout());
  }

  return definition.homeUrl;
};

const parkMediaApp = (
  appId: MediaAppId,
  options?: { keepAudio?: boolean },
) => {
  const runtime = runtimes.get(appId);
  if (!runtime) return;

  rememberMediaUrl(appId, runtime);
  parkEmbeddedWebView(
    context?.getMainWindow()?.contentView ?? null,
    runtime.view,
    { keepAudio: options?.keepAudio ?? true },
  );
};

const disposeMediaApp = (appId: MediaAppId) => {
  const runtime = runtimes.get(appId);
  if (!runtime) return;

  rememberMediaUrl(appId, runtime);
  void disposeEmbeddedWebView(
    context?.getMainWindow()?.contentView ?? null,
    runtime.view,
  );
  runtimes.delete(appId);
};

const suspendMediaApp = parkMediaApp;

const suspendInactiveMediaApps = () => {
  for (const appId of [...runtimes.keys()]) {
    if (appId !== activeAppId) {
      suspendMediaApp(appId);
    }
  }
};

const suspendAllMediaApps = () => {
  for (const appId of [...runtimes.keys()]) {
    parkMediaApp(appId);
  }
};

const disposeAllMediaApps = () => {
  for (const appId of [...runtimes.keys()]) {
    disposeMediaApp(appId);
  }
};

const ensureMediaApp = (appId: MediaAppId) => {
  const existing = runtimes.get(appId);
  if (existing) return existing;

  const definition = getMediaAppDefinition(appId);
  const spotifyIdentity = definition.useChromeIdentity
    ? createSpotifyIdentityController(definition.partition)
    : undefined;
  const resumeUrl = resolveResumeUrl(appId, definition, spotifyIdentity);

  const view = createEmbeddedWebView({
    partition: definition.partition,
    homeUrl: resumeUrl,
    layout: appId === "spotify" ? "desktop" : "desktop",
    spotifyIdentity,
    isTrustedNavigation: createTrustedNavigationCheck(definition.trustedDomains),
    label: definition.label,
    onBeforeInputEvent: context?.onBeforeInputEvent,
  });

  view.setVisible(false);
  const runtime: MediaAppRuntime = { view, spotifyIdentity };
  runtimes.set(appId, runtime);
  return runtime;
};

const warmInactiveMediaApps = () => {
  if (!hubVisible) return;

  clearWarmTimers();
  const hidden = new Set(getHiddenMediaAppIds());
  let delay = 0;

  for (const definition of MEDIA_APP_DEFINITIONS) {
    if (definition.id === activeAppId || hidden.has(definition.id)) continue;

    const appId = definition.id;
    const timer = setTimeout(() => {
      warmTimers.delete(timer);
      if (!hubVisible || activeAppId === appId) return;

      const hadRuntime = runtimes.has(appId);
      ensureMediaApp(appId);
      if (!hadRuntime) {
        parkMediaApp(appId, { keepAudio: true });
      }
    }, delay);

    warmTimers.add(timer);
    delay += 120;
  }
};

const showActiveMediaApp = () => {
  const parent = context?.getMainWindow()?.contentView ?? null;
  if (!parent || !hubVisible || !slotBounds) return;

  suspendInactiveMediaApps();

  const runtime = ensureMediaApp(activeAppId);
  setEmbeddedWebViewVisible(parent, runtime.view, true);
  syncEmbeddedWebViewBounds(parent, runtime.view, slotBounds, true);
  warmInactiveMediaApps();
};

const applySpotifyLayoutIfNeeded = (bounds: ViewBounds) => {
  if (activeAppId !== "spotify" || !bounds.layoutMode) return;
  const runtime = runtimes.get("spotify");
  if (!runtime?.spotifyIdentity) return;
  applySpotifyLayoutMode(runtime.view, runtime.spotifyIdentity, bounds.layoutMode);
};

export const initMediaHub = (hubContext: MediaHubContext) => {
  context = hubContext;
};

export const getActiveMediaHubView = () => {
  if (!hubVisible) return null;
  return runtimes.get(activeAppId)?.view ?? null;
};

export const disposeMediaHub = () => {
  clearWarmTimers();
  disposeAllMediaApps();
  slotBounds = null;
  hubVisible = false;
};

export const registerMediaIpc = () => {
  ipcMain.handle("media:list-apps", () => MEDIA_APPS);

  ipcMain.handle("media:get-active-app", () => activeAppId);

  ipcMain.handle("media:set-active-app", (_event, appId: MediaAppId) => {
    if (!isMediaAppId(appId)) {
      throw new Error(`App de midia invalido: ${String(appId)}`);
    }

    const previousAppId = activeAppId;
    activeAppId = appId;

    if (previousAppId !== appId) {
      suspendMediaApp(previousAppId);
    }

    if (hubVisible) {
      showActiveMediaApp();
    }

    return activeAppId;
  });

  ipcMain.handle("media:set-bounds", (_event, bounds: ViewBounds) => {
    slotBounds = normalizeBounds(bounds);
    applySpotifyLayoutIfNeeded(bounds);
    showActiveMediaApp();
  });

  ipcMain.handle("media:set-visible", (_event, visible: boolean) => {
    hubVisible = visible;
    if (!visible) {
      clearWarmTimers();
      suspendAllMediaApps();
      return;
    }
    showActiveMediaApp();
  });

  ipcMain.handle("media:warm-apps", () => {
    warmInactiveMediaApps();
  });

  ipcMain.handle("media:reload", () => {
    runtimes.get(activeAppId)?.view.webContents.reload();
  });

  ipcMain.handle("media:go-home", () => {
    const runtime = runtimes.get(activeAppId);
    if (!runtime) return;
    const definition = getMediaAppDefinition(activeAppId);
    savedMediaUrls.delete(activeAppId);
    if (activeAppId === "spotify" && runtime.spotifyIdentity) {
      void runtime.view.webContents.loadURL(
        getEmbeddedWebHomeUrl(
          "spotify",
          runtime.spotifyIdentity.getLayout(),
        ),
      );
      return;
    }
    void runtime.view.webContents.loadURL(definition.homeUrl);
  });

  ipcMain.handle("media:capture-preview", () => {
    if (!hubVisible) return null;
    return captureEmbeddedWebPreview(runtimes.get(activeAppId)?.view ?? null);
  });

  ipcMain.handle("media:clear-session", async (_event, appId?: MediaAppId) => {
    const targetId = appId && isMediaAppId(appId) ? appId : activeAppId;
    const definition = getMediaAppDefinition(targetId);
    savedMediaUrls.delete(targetId);

    if (targetId !== activeAppId || !hubVisible) {
      disposeMediaApp(targetId);
    }

    const targetSession = session.fromPartition(definition.partition);
    await targetSession.clearStorageData();
    await targetSession.clearCache();

    const runtime = runtimes.get(targetId);
    if (!runtime) return;

    if (targetId === "spotify" && runtime.spotifyIdentity) {
      await runtime.view.webContents.loadURL(
        getEmbeddedWebHomeUrl(
          "spotify",
          runtime.spotifyIdentity.getLayout(),
        ),
      );
      return;
    }
    await runtime.view.webContents.loadURL(definition.homeUrl);
  });

  ipcMain.handle("media:get-playback-support", () =>
    getSpotifyPlaybackSupport(runtimes.get("spotify")?.view ?? null),
  );

  ipcMain.handle("media:open-spotify-desktop", async () => {
    const candidates = [
      path.join(process.env.APPDATA ?? "", "Spotify", "Spotify.exe"),
      path.join(
        process.env.LOCALAPPDATA ?? "",
        "Microsoft",
        "WindowsApps",
        "Spotify.exe",
      ),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        const error = await shell.openPath(candidate);
        if (!error) return true;
      }
    }

    await shell.openExternal("spotify:");
    return true;
  });
};

export const setMediaHubActiveApp = (appId: MediaAppId) => {
  if (!isMediaAppId(appId)) return;
  activeAppId = appId;
};

export const resolveMediaHubDevToolsTarget = (
  youtubeView: WebContentsView | null,
  youtubeVisible: boolean,
) => {
  const front = getFrontEmbeddedWebView();
  const mediaView = getActiveMediaHubView();
  if (front === mediaView && hubVisible) return mediaView;
  if (front === youtubeView && youtubeVisible) return youtubeView;
  if (hubVisible && mediaView) return mediaView;
  if (youtubeVisible && youtubeView) return youtubeView;
  return null;
};
