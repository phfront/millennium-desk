import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type {
  AppSettings,
  DashboardProfile,
  DashboardLayoutNode,
  DashboardModuleId,
  PreferredDisplay,
  TemperatureUnit,
  ThemePreference,
  WeatherLocation,
} from "../../shared/contracts";
import { isMediaAppId, type MediaAppId } from "../../shared/mediaApps";
import {
  DEFAULT_QUOTE_ASSETS,
  DEFAULT_QUOTE_DISPLAY_CURRENCIES,
  isQuoteAssetCode,
  isQuoteDisplayCurrency,
} from "../../shared/quotes";
import { getDatabase, getDatabasePath } from "../database";

const LEGACY_SETTINGS_FILE = "settings.json";
const SETTINGS_ROW_ID = 1;
const DEFAULT_ACCENT = "#8c8dff";
const DEFAULT_PROFILE_ID = "default";

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "system",
  accentColor: DEFAULT_ACCENT,
  preferredDisplayId: null,
  preferredDisplay: null,
  launchAtStartup: false,
  launchFullscreen: true,
  hiddenModuleIds: [],
  weatherLocation: null,
  weatherSavedLocations: [],
  weatherTemperatureUnit: "celsius",
  dashboardLayout: null,
  activeMediaApp: null,
  hiddenMediaAppIds: [],
  shortcutGrid: { columns: 4, rows: 2 },
  quoteAssets: DEFAULT_QUOTE_ASSETS,
  quoteDisplayCurrencies: DEFAULT_QUOTE_DISPLAY_CURRENCIES,
  activeProfileId: DEFAULT_PROFILE_ID,
  dashboardProfiles: [],
};

const normalizeQuoteAssets = (value: unknown): string[] => {
  if (!Array.isArray(value)) return DEFAULT_SETTINGS.quoteAssets;
  const assets = [...new Set(value.filter(isQuoteAssetCode))].slice(0, 8);
  return assets.length > 0 ? assets : DEFAULT_SETTINGS.quoteAssets;
};

const normalizeQuoteDisplayCurrencies = (value: unknown): string[] => {
  if (!Array.isArray(value)) return DEFAULT_SETTINGS.quoteDisplayCurrencies;
  const currencies = [
    ...new Set(value.filter(isQuoteDisplayCurrency)),
  ].slice(0, 2);
  return currencies.length > 0
    ? currencies
    : DEFAULT_SETTINGS.quoteDisplayCurrencies;
};

const createDefaultSettings = (): AppSettings => ({
  ...DEFAULT_SETTINGS,
  activeProfileId: DEFAULT_PROFILE_ID,
  dashboardProfiles: [
    {
      id: DEFAULT_PROFILE_ID,
      name: "Padrao",
      icon: "",
      dashboardLayout: null,
      hiddenModuleIds: [],
      activeMediaApp: null,
      hiddenMediaAppIds: [],
      theme: DEFAULT_SETTINGS.theme,
      accentColor: DEFAULT_SETTINGS.accentColor,
      shortcutGrid: DEFAULT_SETTINGS.shortcutGrid,
    },
  ],
});

let cachedSettings: AppSettings | null = null;

const isThemePreference = (value: unknown): value is ThemePreference =>
  value === "system" || value === "light" || value === "dark";

const isTemperatureUnit = (value: unknown): value is TemperatureUnit =>
  value === "celsius" || value === "fahrenheit";

const normalizeDashboardModuleId = (
  value: unknown,
): DashboardModuleId | null => {
  if (value === "spotify") return "media";
  if (
    value === "tasks" ||
    value === "weather" ||
    value === "media" ||
    value === "system" ||
    value === "shortcuts" ||
    value === "claude" ||
    value === "quotes"
  ) {
    return value;
  }
  return null;
};

const isDashboardModuleId = (value: unknown): value is DashboardModuleId =>
  normalizeDashboardModuleId(value) !== null;

const normalizeDashboardLayout = (
  value: unknown,
  seen = new Set<DashboardModuleId>(),
): DashboardLayoutNode | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.type === "module") {
    const moduleId = normalizeDashboardModuleId(raw.id);
    if (!moduleId || seen.has(moduleId)) return null;
    seen.add(moduleId);
    return { type: "module", id: moduleId };
  }
  if (
    raw.type !== "split" ||
    (raw.direction !== "row" && raw.direction !== "column") ||
    typeof raw.ratio !== "number" ||
    !Number.isFinite(raw.ratio)
  ) {
    return null;
  }
  const first = normalizeDashboardLayout(raw.first, seen);
  const second = normalizeDashboardLayout(raw.second, seen);
  if (!first) return second;
  if (!second) return first;
  const minimumRatio = raw.direction === "column" ? 0.1 : 0.2;
  return {
    type: "split",
    direction: raw.direction,
    ratio: Math.min(1 - minimumRatio, Math.max(minimumRatio, raw.ratio)),
    first,
    second,
  };
};

const normalizeWeatherLocation = (value: unknown): WeatherLocation | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<WeatherLocation>;
  if (
    typeof raw.id !== "number" ||
    typeof raw.name !== "string" ||
    typeof raw.region !== "string" ||
    typeof raw.country !== "string" ||
    typeof raw.latitude !== "number" ||
    typeof raw.longitude !== "number" ||
    typeof raw.timezone !== "string"
  ) {
    return null;
  }
  const location = { ...raw } as WeatherLocation;
  if (typeof location.label !== "string" || location.label.trim() === "") {
    delete location.label;
  }
  return location;
};

const normalizePreferredDisplay = (value: unknown): PreferredDisplay | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<PreferredDisplay>;
  const bounds = raw.bounds as Partial<PreferredDisplay["bounds"]> | undefined;
  if (
    typeof raw.id !== "number" ||
    !Number.isSafeInteger(raw.id) ||
    typeof raw.label !== "string" ||
    typeof raw.scaleFactor !== "number" ||
    !Number.isFinite(raw.scaleFactor) ||
    !bounds ||
    typeof bounds.x !== "number" ||
    typeof bounds.y !== "number" ||
    typeof bounds.width !== "number" ||
    typeof bounds.height !== "number"
  ) {
    return null;
  }

  return {
    id: raw.id,
    label: raw.label,
    scaleFactor: raw.scaleFactor,
    bounds: {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    },
  };
};

const normalizeHexColor = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const short = trimmed.match(/^#([0-9a-fA-F]{3})$/);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const full = trimmed.match(/^#([0-9a-fA-F]{6})$/);
  return full ? `#${full[1].toLowerCase()}` : null;
};

const normalizeShortcutGrid = (value: unknown): AppSettings["shortcutGrid"] => {
  const raw = value as Partial<AppSettings["shortcutGrid"]> | null | undefined;
  const columns = raw?.columns;
  const rows = raw?.rows;
  return {
    columns:
      typeof columns === "number" && Number.isSafeInteger(columns)
        ? Math.min(8, Math.max(1, columns))
        : DEFAULT_SETTINGS.shortcutGrid.columns,
    rows:
      typeof rows === "number" && Number.isSafeInteger(rows)
        ? Math.min(6, Math.max(1, rows))
        : DEFAULT_SETTINGS.shortcutGrid.rows,
  };
};

const normalizeProfileId = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^[a-zA-Z0-9_-]{1,48}$/.test(trimmed) ? trimmed : null;
};

const normalizeProfileIconValue = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("data:image/")) {
    return trimmed.length <= 512_000 ? trimmed : "";
  }
  return trimmed.slice(0, 8);
};

const normalizeDashboardProfile = (value: unknown): DashboardProfile | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<DashboardProfile>;
  const id = normalizeProfileId(raw.id);
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!id || !name) return null;

  return {
    id,
    name: name.slice(0, 40),
    icon: normalizeProfileIconValue(raw.icon),
    dashboardLayout: normalizeDashboardLayout(raw.dashboardLayout),
    hiddenModuleIds: Array.isArray(raw.hiddenModuleIds)
      ? raw.hiddenModuleIds.filter((item): item is string => typeof item === "string")
      : [],
    activeMediaApp: isMediaAppId(raw.activeMediaApp)
      ? raw.activeMediaApp
      : DEFAULT_SETTINGS.activeMediaApp,
    hiddenMediaAppIds: Array.isArray(raw.hiddenMediaAppIds)
      ? raw.hiddenMediaAppIds.filter((id): id is MediaAppId => isMediaAppId(id))
      : [],
    theme: isThemePreference(raw.theme) ? raw.theme : DEFAULT_SETTINGS.theme,
    accentColor: normalizeHexColor(raw.accentColor) ?? DEFAULT_SETTINGS.accentColor,
    shortcutGrid: normalizeShortcutGrid(raw.shortcutGrid),
  };
};

const normalizeWeatherLocations = (value: unknown): WeatherLocation[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const location = normalizeWeatherLocation(item);
    return location ? [location] : [];
  });
};

const normalizeSettings = (value: unknown): AppSettings => {
  if (!value || typeof value !== "object") return createDefaultSettings();

  const raw = value as Partial<AppSettings>;
  const weatherLocation = normalizeWeatherLocation(raw.weatherLocation);
  let weatherSavedLocations = normalizeWeatherLocations(raw.weatherSavedLocations);
  if (weatherSavedLocations.length === 0 && weatherLocation) {
    weatherSavedLocations = [weatherLocation];
  }
  const shortcutGrid = normalizeShortcutGrid(raw.shortcutGrid);
  const dashboardLayout = normalizeDashboardLayout(raw.dashboardLayout);
  const activeMediaApp = isMediaAppId(raw.activeMediaApp)
    ? raw.activeMediaApp
    : DEFAULT_SETTINGS.activeMediaApp;
  const hiddenMediaAppIds = Array.isArray(raw.hiddenMediaAppIds)
    ? raw.hiddenMediaAppIds.filter((id): id is MediaAppId => isMediaAppId(id))
    : DEFAULT_SETTINGS.hiddenMediaAppIds;
  const dashboardProfiles = Array.isArray(raw.dashboardProfiles)
    ? raw.dashboardProfiles.flatMap((item) => {
        const profile = normalizeDashboardProfile(item);
        return profile ? [profile] : [];
      })
    : [];
  const activeProfileId =
    normalizeProfileId(raw.activeProfileId) ?? DEFAULT_PROFILE_ID;
  const profiles =
    dashboardProfiles.length > 0
      ? dashboardProfiles
      : [
          {
            id: DEFAULT_PROFILE_ID,
            name: "Padrao",
            icon: "",
            dashboardLayout,
            hiddenModuleIds: Array.isArray(raw.hiddenModuleIds)
              ? raw.hiddenModuleIds.filter(
                  (id): id is string => typeof id === "string",
                )
              : DEFAULT_SETTINGS.hiddenModuleIds,
            activeMediaApp,
            hiddenMediaAppIds,
            theme: isThemePreference(raw.theme)
              ? raw.theme
              : DEFAULT_SETTINGS.theme,
            accentColor:
              normalizeHexColor(raw.accentColor) ??
              DEFAULT_SETTINGS.accentColor,
            shortcutGrid,
          },
        ];

  return {
    theme: isThemePreference(raw.theme) ? raw.theme : DEFAULT_SETTINGS.theme,
    accentColor:
      normalizeHexColor(raw.accentColor) ?? DEFAULT_SETTINGS.accentColor,
    preferredDisplayId:
      typeof raw.preferredDisplayId === "number" &&
      Number.isSafeInteger(raw.preferredDisplayId)
        ? raw.preferredDisplayId
        : DEFAULT_SETTINGS.preferredDisplayId,
    preferredDisplay: normalizePreferredDisplay(raw.preferredDisplay),
    launchAtStartup:
      typeof raw.launchAtStartup === "boolean"
        ? raw.launchAtStartup
        : DEFAULT_SETTINGS.launchAtStartup,
    launchFullscreen:
      typeof raw.launchFullscreen === "boolean"
        ? raw.launchFullscreen
        : DEFAULT_SETTINGS.launchFullscreen,
    hiddenModuleIds: Array.isArray(raw.hiddenModuleIds)
      ? raw.hiddenModuleIds.filter(
          (id): id is string => typeof id === "string",
        )
      : DEFAULT_SETTINGS.hiddenModuleIds,
    weatherLocation,
    weatherSavedLocations,
    weatherTemperatureUnit: isTemperatureUnit(raw.weatherTemperatureUnit)
      ? raw.weatherTemperatureUnit
      : DEFAULT_SETTINGS.weatherTemperatureUnit,
    dashboardLayout,
    activeMediaApp,
    hiddenMediaAppIds,
    shortcutGrid,
    quoteAssets: normalizeQuoteAssets(raw.quoteAssets),
    quoteDisplayCurrencies: normalizeQuoteDisplayCurrencies(
      raw.quoteDisplayCurrencies,
    ),
    activeProfileId: profiles.some((profile) => profile.id === activeProfileId)
      ? activeProfileId
      : profiles[0]?.id ?? DEFAULT_PROFILE_ID,
    dashboardProfiles: profiles,
  };
};

const readRawPayload = (): unknown => {
  const row = getDatabase()
    .prepare("SELECT payload FROM app_settings WHERE id = ?")
    .get(SETTINGS_ROW_ID) as { payload: string } | undefined;

  if (!row?.payload) return null;

  try {
    return JSON.parse(row.payload.replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
};

const writeSettings = (settings: AppSettings) => {
  getDatabase()
    .prepare(
      `INSERT INTO app_settings (id, payload)
       VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`,
    )
    .run(SETTINGS_ROW_ID, `${JSON.stringify(settings)}\n`);
};

// A serializacao inclui perfis com icones em data URL (ate ~512KB cada);
// eventos frequentes (ex.: "move"/"resize" da janela) nao devem pagar esse
// custo a cada disparo. As leituras continuam vindo de cachedSettings.
const WRITE_DEBOUNCE_MS = 150;
let pendingWriteTimer: NodeJS.Timeout | null = null;

const writeCachedSettings = () => {
  if (!cachedSettings) return;
  try {
    writeSettings(cachedSettings);
  } catch (error) {
    // Banco pode ja ter sido fechado durante o encerramento.
    console.error("Falha ao gravar configuracoes:", error);
  }
};

export const flushSettingsStore = () => {
  if (pendingWriteTimer) {
    clearTimeout(pendingWriteTimer);
    pendingWriteTimer = null;
  }
  writeCachedSettings();
};

const scheduleSettingsWrite = () => {
  if (pendingWriteTimer) clearTimeout(pendingWriteTimer);
  pendingWriteTimer = setTimeout(() => {
    pendingWriteTimer = null;
    writeCachedSettings();
  }, WRITE_DEBOUNCE_MS);
};

const migrateLegacySettingsFile = (userDataPath: string) => {
  const jsonPath = path.join(userDataPath, LEGACY_SETTINGS_FILE);
  if (!existsSync(jsonPath)) return;

  const row = getDatabase()
    .prepare("SELECT payload FROM app_settings WHERE id = ?")
    .get(SETTINGS_ROW_ID) as { payload: string } | undefined;
  const rawPayload = row?.payload?.trim() ?? "{}";
  if (rawPayload !== "{}" && rawPayload !== "") return;

  try {
    const legacy = normalizeSettings(
      JSON.parse(readFileSync(jsonPath, "utf8").replace(/^\uFEFF/, "")),
    );
    writeSettings(legacy);
    cachedSettings = legacy;
  } catch (error) {
    console.error("Falha ao importar settings.json legado:", error);
  }
};

export const initSettingsStore = (userDataPath: string) => {
  migrateLegacySettingsFile(userDataPath);
};

export const getSettings = (): AppSettings => {
  if (cachedSettings) return cachedSettings;

  cachedSettings = normalizeSettings(readRawPayload());
  return cachedSettings;
};

export const updateSettings = (
  patch: Partial<AppSettings>,
  options?: { flush?: boolean },
): AppSettings => {
  const current = getSettings();
  const next = normalizeSettings({ ...current, ...patch });
  cachedSettings = next;
  if (options?.flush) {
    flushSettingsStore();
  } else {
    scheduleSettingsWrite();
  }
  return next;
};

export const getSettingsPath = () => getDatabasePath();
