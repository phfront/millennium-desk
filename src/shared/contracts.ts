import type { MediaAppId, MediaAppInfo } from "./mediaApps";
import type {
  LogCategory,
  LogEntry,
  LogLevel,
  LogQuery,
} from "./logTypes";

export type { LogCategory, LogEntry, LogLevel, LogQuery };
export {
  LOG_CATEGORIES,
  LOG_CATEGORY_LABELS,
  LOG_LEVEL_LABELS,
  LOG_LEVELS,
} from "./logTypes";

export type ThemePreference = "system" | "light" | "dark";
export type TemperatureUnit = "celsius" | "fahrenheit";
export type DashboardModuleId =
  | "tasks"
  | "weather"
  | "youtube"
  | "media"
  | "system"
  | "shortcuts";

export type ShortcutType =
  | "app"
  | "file"
  | "url"
  | "batch"
  | "powershell";

export interface ShortcutItem {
  id: number;
  name: string;
  type: ShortcutType;
  target: string;
  args: string[];
  workingDirectory: string | null;
  color: string;
  color2: string;
  iconDataUrl: string | null;
  imageOnly: boolean;
  confirmBeforeRun: boolean;
  sortOrder: number;
  gridSlot: number;
}

export interface SaveShortcutInput {
  id?: number;
  name: string;
  type: ShortcutType;
  target: string;
  args?: string[];
  workingDirectory?: string | null;
  color?: string;
  color2?: string;
  iconDataUrl?: string | null;
  imageOnly?: boolean;
  confirmBeforeRun?: boolean;
}

export interface ShortcutExecutionResult {
  shortcutId: number;
  started: boolean;
  message: string;
}

export interface ShortcutGridSettings {
  columns: number;
  rows: number;
}

export interface SystemStatus {
  cpuPercent: number;
  memory: {
    totalBytes: number;
    usedBytes: number;
    usedPercent: number;
  };
  gpu: {
    available: boolean;
    utilizationPercent: number | null;
    label: string | null;
  };
  network: {
    downloadBytesPerSec: number;
    uploadBytesPerSec: number;
  };
  disk: {
    activePercent: number | null;
    readBytesPerSec: number;
    writeBytesPerSec: number;
  };
}

export type DashboardLayoutNode =
  | { type: "module"; id: DashboardModuleId }
  | {
      type: "split";
      direction: "row" | "column";
      ratio: number;
      first: DashboardLayoutNode;
      second: DashboardLayoutNode;
    };

export interface PreferredDisplay {
  id: number;
  label: string;
  scaleFactor: number;
  bounds: ViewBounds;
}

export interface WeatherLocation {
  id: number;
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface AppSettings {
  theme: ThemePreference;
  accentColor: string;
  preferredDisplayId: number | null;
  /** Identidade persistente usada quando o Windows altera os IDs dos monitores. */
  preferredDisplay: PreferredDisplay | null;
  /** Registra o app para abrir ao iniciar o Windows. */
  launchAtStartup: boolean;
  /** Abre em tela cheia no monitor preferido. */
  launchFullscreen: boolean;
  hiddenModuleIds: string[];
  weatherLocation: WeatherLocation | null;
  weatherSavedLocations: WeatherLocation[];
  weatherTemperatureUnit: TemperatureUnit;
  dashboardLayout: DashboardLayoutNode | null;
  activeMediaApp: MediaAppId | null;
  /** Apps ocultos no dock do hub de midia (permanecem estacionados em memoria). */
  hiddenMediaAppIds: MediaAppId[];
  shortcutGrid: ShortcutGridSettings;
}

export interface WeatherCurrent {
  time: string;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  precipitationProbability: number;
  weatherCode: number;
  isDay: boolean;
  windSpeed: number;
}

export interface WeatherHourly {
  time: string;
  temperature: number;
  precipitationProbability: number;
  weatherCode: number;
}

export interface WeatherDaily {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitationProbability: number;
  weatherCode: number;
  sunrise: string;
  sunset: string;
}

export interface WeatherForecast {
  location: WeatherLocation;
  temperatureUnit: "°C" | "°F";
  windSpeedUnit: "km/h" | "mph";
  fetchedAt: string;
  current: WeatherCurrent;
  hourly: WeatherHourly[];
  daily: WeatherDaily[];
}

export interface TaskTag {
  id: number;
  name: string;
  color: string;
}

export interface TaskItem {
  id: number;
  text: string;
  done: boolean;
  tagIds: number[];
}

export interface CreateTagInput {
  name: string;
  color: string;
}

export interface UpdateTagInput extends CreateTagInput {
  id: number;
}

export interface CreateTaskInput {
  date: string;
  text: string;
  tagIds?: number[];
}

export interface UpdateTaskInput {
  id: number;
  text?: string;
  done?: boolean;
  tagIds?: number[];
}

export interface TaskExportRecord {
  id: number;
  date: string;
  text: string;
  done: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskExportPayload {
  exportedAt: string;
  today: string;
  tasks: TaskExportRecord[];
}

export interface TaskStorageInfo {
  path: string;
}

export interface ViewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  layoutMode?: "mobile" | "desktop";
}

export interface DisplayInfo {
  id: number;
  label: string;
  scaleFactor: number;
  bounds: ViewBounds;
  workArea: ViewBounds;
  primary: boolean;
}

export interface ElectronControlApi {
  settings: {
    get(): Promise<AppSettings>;
    update(patch: Partial<AppSettings>): Promise<AppSettings>;
    flush(patch: Partial<AppSettings>): AppSettings;
    getPath(): Promise<{ path: string }>;
  };
  tasks: {
    listByDate(date: string): Promise<TaskItem[]>;
    create(input: CreateTaskInput): Promise<TaskItem>;
    update(input: UpdateTaskInput): Promise<TaskItem>;
    delete(id: number): Promise<void>;
    exportJson(): Promise<TaskExportPayload>;
    getDatabasePath(): Promise<TaskStorageInfo>;
  };
  tags: {
    list(): Promise<TaskTag[]>;
    create(input: CreateTagInput): Promise<TaskTag>;
    update(input: UpdateTagInput): Promise<TaskTag>;
    delete(id: number): Promise<void>;
  };
  weather: {
    searchLocations(query: string): Promise<WeatherLocation[]>;
    getForecast(
      location: WeatherLocation,
      temperatureUnit: TemperatureUnit,
    ): Promise<WeatherForecast>;
  };
  system: {
    getStatus(): Promise<SystemStatus>;
  };
  shortcuts: {
    list(): Promise<ShortcutItem[]>;
    save(input: SaveShortcutInput): Promise<ShortcutItem>;
    delete(id: number): Promise<void>;
    reorder(ids: number[]): Promise<ShortcutItem[]>;
    place(id: number, slot: number): Promise<ShortcutItem[]>;
    execute(id: number): Promise<ShortcutExecutionResult>;
  };
  youtube: {
    setBounds(bounds: ViewBounds): Promise<void>;
    setVisible(visible: boolean): Promise<void>;
    reload(): Promise<void>;
    goHome(): Promise<void>;
    capturePreview(): Promise<string | null>;
  };
  media: {
    listApps(): Promise<MediaAppInfo[]>;
    getActiveApp(): Promise<MediaAppId>;
    setActiveApp(appId: MediaAppId): Promise<MediaAppId>;
    setBounds(bounds: ViewBounds): Promise<void>;
    setVisible(visible: boolean): Promise<void>;
    reload(): Promise<void>;
    goHome(): Promise<void>;
    capturePreview(): Promise<string | null>;
    getPlaybackSupport(): Promise<{
      widevine: boolean;
      widevineRegistered: boolean;
      widevineVersion: string | null;
      userAgent: string | null;
    }>;
    clearSession(appId?: MediaAppId): Promise<void>;
    openSpotifyDesktop(): Promise<boolean>;
    warmApps(): Promise<void>;
  };
  window: {
    toggleFullscreen(): Promise<boolean>;
    isFullscreen(): Promise<boolean>;
    onFullscreenChanged(callback: (fullscreen: boolean) => void): () => void;
    onDisplayChanged(callback: (display: DisplayInfo) => void): () => void;
    moveToDisplay(displayId: number): Promise<DisplayInfo>;
    moveToNextDisplay(): Promise<DisplayInfo>;
    getDisplays(): Promise<DisplayInfo[]>;
  };
  logs: {
    query(query?: LogQuery): Promise<LogEntry[]>;
    clear(): Promise<boolean>;
    onEntry(callback: (entry: LogEntry) => void): () => void;
  };
}
