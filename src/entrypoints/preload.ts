import { contextBridge, ipcRenderer } from "electron";
import type {
  AppSettings,
  CreateTagInput,
  CreateTaskInput,
  DisplayInfo,
  ElectronControlApi,
  LogEntry,
  LogQuery,
  SaveShortcutInput,
  TemperatureUnit,
  UpdateTagInput,
  UpdateTaskInput,
  ViewBounds,
  WeatherLocation,
} from "../shared/contracts";
import type { MediaAppId } from "../shared/mediaApps";

const api: ElectronControlApi = {
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    update: (patch: Partial<AppSettings>) =>
      ipcRenderer.invoke("settings:update", patch),
    flush: (patch: Partial<AppSettings>) =>
      ipcRenderer.sendSync("settings:flush-sync", patch) as AppSettings,
    getPath: () => ipcRenderer.invoke("settings:get-path"),
  },
  tasks: {
    listByDate: (date: string) =>
      ipcRenderer.invoke("tasks:list-by-date", date),
    create: (input: CreateTaskInput) =>
      ipcRenderer.invoke("tasks:create", input),
    update: (input: UpdateTaskInput) =>
      ipcRenderer.invoke("tasks:update", input),
    delete: (id: number) => ipcRenderer.invoke("tasks:delete", id),
    exportJson: () => ipcRenderer.invoke("tasks:export-json"),
    getDatabasePath: () => ipcRenderer.invoke("tasks:get-database-path"),
  },
  tags: {
    list: () => ipcRenderer.invoke("tags:list"),
    create: (input: CreateTagInput) => ipcRenderer.invoke("tags:create", input),
    update: (input: UpdateTagInput) => ipcRenderer.invoke("tags:update", input),
    delete: (id: number) => ipcRenderer.invoke("tags:delete", id),
  },
  weather: {
    searchLocations: (query: string) =>
      ipcRenderer.invoke("weather:search-locations", query),
    getForecast: (
      location: WeatherLocation,
      temperatureUnit: TemperatureUnit,
    ) => ipcRenderer.invoke("weather:get-forecast", location, temperatureUnit),
  },
  system: {
    getStatus: () => ipcRenderer.invoke("system:get-status"),
  },
  claude: {
    listSessions: () => ipcRenderer.invoke("claude:list-sessions"),
  },
  shortcuts: {
    list: () => ipcRenderer.invoke("shortcuts:list"),
    save: (input: SaveShortcutInput) =>
      ipcRenderer.invoke("shortcuts:save", input),
    delete: (id: number) => ipcRenderer.invoke("shortcuts:delete", id),
    reorder: (ids: number[]) => ipcRenderer.invoke("shortcuts:reorder", ids),
    place: (id: number, slot: number) =>
      ipcRenderer.invoke("shortcuts:place", id, slot),
    execute: (id: number) => ipcRenderer.invoke("shortcuts:execute", id),
  },
  youtube: {
    setBounds: (bounds: ViewBounds) =>
      ipcRenderer.invoke("youtube:set-bounds", bounds),
    setVisible: (visible: boolean) =>
      ipcRenderer.invoke("youtube:set-visible", visible),
    reload: () => ipcRenderer.invoke("youtube:reload"),
    goHome: () => ipcRenderer.invoke("youtube:go-home"),
    capturePreview: () =>
      ipcRenderer.invoke("youtube:capture-preview") as Promise<string | null>,
  },
  media: {
    listApps: () => ipcRenderer.invoke("media:list-apps"),
    getActiveApp: () => ipcRenderer.invoke("media:get-active-app"),
    setActiveApp: (appId: MediaAppId) =>
      ipcRenderer.invoke("media:set-active-app", appId),
    setBounds: (bounds: ViewBounds) =>
      ipcRenderer.invoke("media:set-bounds", bounds),
    setVisible: (visible: boolean) =>
      ipcRenderer.invoke("media:set-visible", visible),
    reload: () => ipcRenderer.invoke("media:reload"),
    goHome: () => ipcRenderer.invoke("media:go-home"),
    capturePreview: () =>
      ipcRenderer.invoke("media:capture-preview") as Promise<string | null>,
    getPlaybackSupport: () =>
      ipcRenderer.invoke("media:get-playback-support") as Promise<{
        widevine: boolean;
        widevineRegistered: boolean;
        widevineVersion: string | null;
        userAgent: string | null;
      }>,
    clearSession: (appId?: MediaAppId) =>
      ipcRenderer.invoke("media:clear-session", appId),
    openSpotifyDesktop: () =>
      ipcRenderer.invoke("media:open-spotify-desktop") as Promise<boolean>,
    warmApps: () => ipcRenderer.invoke("media:warm-apps") as Promise<void>,
    showControlsMenu: (mediaFullscreen: boolean, anchor: ViewBounds) =>
      ipcRenderer.invoke(
        "media:show-controls-menu",
        mediaFullscreen,
        anchor,
      ) as Promise<boolean>,
    setFullscreenOverlayActive: (active: boolean) =>
      ipcRenderer.invoke("media:set-fullscreen-overlay-active", active),
    onFullscreenOverlayExit: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on("media:fullscreen-overlay-exit", listener);
      return () =>
        ipcRenderer.removeListener("media:fullscreen-overlay-exit", listener);
    },
    onFullscreenMenuToggle: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on("media:fullscreen-menu-toggle", listener);
      return () =>
        ipcRenderer.removeListener("media:fullscreen-menu-toggle", listener);
    },
    onControlsMenuClosed: (callback: () => void) => {
      const listener = () => callback();
      ipcRenderer.on("media:controls-menu-closed", listener);
      return () =>
        ipcRenderer.removeListener("media:controls-menu-closed", listener);
    },
  },
  window: {
    toggleFullscreen: () => ipcRenderer.invoke("window:toggle-fullscreen"),
    isFullscreen: () => ipcRenderer.invoke("window:is-fullscreen"),
    minimize: () => ipcRenderer.invoke("window:minimize"),
    toggleMaximize: () =>
      ipcRenderer.invoke("window:toggle-maximize") as Promise<boolean>,
    close: () => ipcRenderer.invoke("window:close"),
    onFullscreenChanged: (callback: (fullscreen: boolean) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, value: boolean) =>
        callback(value);
      ipcRenderer.on("window:fullscreen-changed", listener);
      return () =>
        ipcRenderer.removeListener("window:fullscreen-changed", listener);
    },
    onDisplayChanged: (callback: (display: DisplayInfo) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, value: DisplayInfo) =>
        callback(value);
      ipcRenderer.on("window:display-changed", listener);
      return () => ipcRenderer.removeListener("window:display-changed", listener);
    },
    moveToDisplay: (displayId: number) =>
      ipcRenderer.invoke(
        "window:move-to-display",
        displayId,
      ) as Promise<DisplayInfo>,
    moveToNextDisplay: () =>
      ipcRenderer.invoke("window:move-to-next-display") as Promise<DisplayInfo>,
    getDisplays: () =>
      ipcRenderer.invoke("window:get-displays") as Promise<DisplayInfo[]>,
  },
  logs: {
    query: (query?: LogQuery) =>
      ipcRenderer.invoke("logs:query", query) as Promise<LogEntry[]>,
    clear: () => ipcRenderer.invoke("logs:clear") as Promise<boolean>,
    onEntry: (callback: (entry: LogEntry) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, entry: LogEntry) =>
        callback(entry);
      ipcRenderer.on("logs:entry", listener);
      return () => ipcRenderer.removeListener("logs:entry", listener);
    },
  },
};

contextBridge.exposeInMainWorld("electronControl", api);
