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
  | "media"
  | "system"
  | "shortcuts"
  | "quotes"
  | "shello"
  | "soundboard";

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
  gridSlot?: number;
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

/** Som do modulo de efeitos, tocado na saida do microfone virtual. */
export interface SoundItem {
  id: number;
  name: string;
  /** Emoji (ou texto curto) exibido no botao; vazio usa o nome. */
  emoji: string;
  color: string;
  color2: string;
  /** Volume proprio do som, de 0 a 1. */
  volume: number;
  /** Nome do arquivo na pasta sounds do userData. */
  fileName: string;
  gridSlot: number;
}

export interface SoundAudioUpload {
  bytes: Uint8Array;
  /** Extensao do arquivo original, sem ponto (mp3, wav, ogg...). */
  extension: string;
}

export interface SaveSoundInput {
  id?: number;
  name: string;
  emoji?: string;
  color?: string;
  color2?: string;
  volume?: number;
  gridSlot?: number;
  /** Obrigatorio ao criar; ao editar, so quando o arquivo e trocado. */
  audio?: SoundAudioUpload;
}

export interface SoundAudioData {
  bytes: Uint8Array;
  mimeType: string;
}

export interface SoundboardSettings {
  /** Saida que alimenta o microfone virtual (ex.: CABLE Input do VB-Cable). */
  outputDeviceId: string;
  /** Rotulo da saida, para reencontrar o dispositivo se o id mudar. */
  outputDeviceLabel: string;
  /** Toca tambem no fone, para ouvir o que os outros estao ouvindo. */
  monitorEnabled: boolean;
  /** Saida do retorno; vazio usa a saida padrao do Windows. */
  monitorDeviceId: string;
  monitorDeviceLabel: string;
  /** Volume geral na saida do microfone, de 0 a 1. */
  volume: number;
  /** Volume geral no retorno, de 0 a 1. */
  monitorVolume: number;
  grid: ShortcutGridSettings;
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

export interface QuoteValue {
  currency: string;
  value: number;
}

export interface QuoteItem {
  code: string;
  label: string;
  /** Valores na(s) moeda(s) de exibicao escolhidas, em ordem. */
  values: QuoteValue[];
  pctChange: number;
  updatedAt: string;
}

export interface QuotesSnapshot {
  quotes: QuoteItem[];
  fetchedAt: string;
}

export interface QuoteAssetOption {
  code: string;
  label: string;
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

/** Apps da Smart TV com webview aberto (tocando ou estacionados). */
export interface MediaPowerState {
  runningAppIds: MediaAppId[];
  activeAppPoweredOff: boolean;
}

export interface PreferredDisplay {
  id: number;
  label: string;
  scaleFactor: number;
  bounds: ViewBounds;
}

export interface WeatherLocation {
  id: number;
  name: string;
  /** Apelido definido pelo usuario; substitui name apenas na exibicao. */
  label?: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface TaskListSettings {
  /** Ordena pendentes antes das concluidas dentro de cada grupo. */
  pendingFirst: boolean;
  /** Mostra a barra de progresso do dia. */
  showProgress: boolean;
  /** Tags na propria linha do texto, em vez de ancoradas no canto. */
  inlineTags: boolean;
  /** Linha compacta: altura menor, recuo simetrico e checkbox reduzido. */
  denseRows: boolean;
  /** Lista continua com separadores, em vez de um cartao por tarefa. */
  flatList: boolean;
  /** Trunca o texto em uma linha (o texto completo fica no title). */
  truncateText: boolean;
  /** Divisor de grupo compacto, sem a regua ocupando altura. */
  compactHeaders: boolean;
  /** Nas linhas com tag, texto vai para a segunda linha em largura total. */
  textBelow: boolean;
  /** Ancora a tag no canto direito da linha, em vez do inicio. */
  tagsRight: boolean;
}

export interface DashboardProfile {
  id: string;
  name: string;
  icon: string;
  dashboardLayout: DashboardLayoutNode | null;
  hiddenModuleIds: string[];
  activeMediaApp: MediaAppId | null;
  hiddenMediaAppIds: MediaAppId[];
  theme: ThemePreference;
  accentColor: string;
  shortcutGrid: ShortcutGridSettings;
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
  /** Preferencias visuais e de ordenacao do modulo de tarefas. */
  taskList: TaskListSettings;
  /** Ativos acompanhados no modulo de cotacoes. */
  quoteAssets: string[];
  /** Moedas de exibicao (1 ou 2; a segunda aparece entre parenteses). */
  quoteDisplayCurrencies: string[];
  activeProfileId: string;
  dashboardProfiles: DashboardProfile[];
  /** Painel do Claude Code (Shello / Claude Web) exibido no Desk. */
  shello: ShelloSettings;
  /** Modulo de sons tocados no microfone virtual. */
  soundboard: SoundboardSettings;
}

/**
 * grid: o Resumo do Shello como modulo da grade.
 * drawer: o app completo numa gaveta lateral, aberta pela aba na borda.
 */
export type ShelloDisplayMode = "grid" | "drawer";

export interface ShelloSettings {
  mode: ShelloDisplayMode;
  /** Endereco do servidor do Shello neste PC (so loopback). */
  url: string;
}

/** Estado da view do Shello, enviado pelo processo principal. */
export interface ShelloState {
  /** Sessoes esperando resposta (vem do titulo da pagina, "(n) Claude Web"). */
  waiting: number;
  /** Servidor fora do ar: a view some e o modulo mostra o aviso. */
  offline: boolean;
  drawerOpen: boolean;
}

export interface ShelloSurface {
  mode: ShelloDisplayMode;
  /** Retangulo do slot do modulo (grid) ou da area da grade (drawer). */
  bounds: ViewBounds | null;
  visible: boolean;
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
  /** Recorrente: aparece todos os dias, no fim da lista, ate ser concluida. */
  persistent: boolean;
  /** Migra sozinha para o dia seguinte enquanto nao for concluida. */
  rollover: boolean;
  /** Chave YYYY-MM-DD do dia em que a tarefa recorrente foi concluida. */
  completedOn: string | null;
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
  persistent?: boolean;
  rollover?: boolean;
}

export interface UpdateTaskInput {
  id: number;
  date?: string;
  text?: string;
  done?: boolean;
  tagIds?: number[];
  persistent?: boolean;
  rollover?: boolean;
}

export interface TaskExportRecord {
  id: number;
  date: string;
  text: string;
  done: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  persistent: boolean;
  rollover: boolean;
  completedOn: string | null;
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
  quotes: {
    get(
      assets: string[],
      displayCurrencies: string[],
    ): Promise<QuotesSnapshot>;
    searchAssets(query: string): Promise<QuoteAssetOption[]>;
  };
  shortcuts: {
    list(): Promise<ShortcutItem[]>;
    save(input: SaveShortcutInput): Promise<ShortcutItem>;
    delete(id: number): Promise<void>;
    reorder(ids: number[]): Promise<ShortcutItem[]>;
    place(id: number, slot: number): Promise<ShortcutItem[]>;
    execute(id: number): Promise<ShortcutExecutionResult>;
  };
  sounds: {
    list(): Promise<SoundItem[]>;
    save(input: SaveSoundInput): Promise<SoundItem>;
    delete(id: number): Promise<void>;
    place(id: number, slot: number): Promise<SoundItem[]>;
    readAudio(id: number): Promise<SoundAudioData>;
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
    showControlsMenu(
      mediaFullscreen: boolean,
      anchor: ViewBounds,
    ): Promise<boolean>;
    setFullscreenOverlayActive(active: boolean): Promise<void>;
    onFullscreenOverlayExit(callback: () => void): () => void;
    onFullscreenMenuToggle(callback: () => void): () => void;
    onControlsMenuClosed(callback: () => void): () => void;
    showAppMenu(appId: MediaAppId, anchor: ViewBounds): Promise<boolean>;
    powerOffApp(appId: MediaAppId): Promise<void>;
    getPowerState(): Promise<MediaPowerState>;
    onPowerStateChanged(callback: (state: MediaPowerState) => void): () => void;
    onPowerOnRequest(callback: (appId: MediaAppId) => void): () => void;
  };
  shello: {
    sync(surface: ShelloSurface): Promise<void>;
    setDrawerOpen(open: boolean): Promise<void>;
    reload(): Promise<void>;
    capturePreview(): Promise<string | null>;
    getState(): Promise<ShelloState>;
    onState(callback: (state: ShelloState) => void): () => void;
  };
  window: {
    toggleFullscreen(): Promise<boolean>;
    isFullscreen(): Promise<boolean>;
    minimize(): Promise<void>;
    toggleMaximize(): Promise<boolean>;
    close(): Promise<void>;
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
