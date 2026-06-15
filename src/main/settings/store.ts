import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type {
  AppSettings,
  DashboardLayoutNode,
  DashboardModuleId,
  PreferredDisplay,
  TemperatureUnit,
  ThemePreference,
  WeatherLocation,
} from "../../shared/contracts";
import { isMediaAppId, type MediaAppId } from "../../shared/mediaApps";
import { getDatabase, getDatabasePath } from "../database";

const LEGACY_SETTINGS_FILE = "settings.json";
const SETTINGS_ROW_ID = 1;
const DEFAULT_ACCENT = "#8c8dff";

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
};

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
    value === "youtube" ||
    value === "media" ||
    value === "system" ||
    value === "shortcuts"
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
  if (!first || !second) return null;
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
  return raw as WeatherLocation;
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

const normalizeWeatherLocations = (value: unknown): WeatherLocation[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const location = normalizeWeatherLocation(item);
    return location ? [location] : [];
  });
};

const normalizeSettings = (value: unknown): AppSettings => {
  if (!value || typeof value !== "object") return { ...DEFAULT_SETTINGS };

  const raw = value as Partial<AppSettings>;
  const rawShortcutGrid = raw.shortcutGrid;
  const weatherLocation = normalizeWeatherLocation(raw.weatherLocation);
  let weatherSavedLocations = normalizeWeatherLocations(raw.weatherSavedLocations);
  if (weatherSavedLocations.length === 0 && weatherLocation) {
    weatherSavedLocations = [weatherLocation];
  }
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
    dashboardLayout: normalizeDashboardLayout(raw.dashboardLayout),
    activeMediaApp: isMediaAppId(raw.activeMediaApp)
      ? raw.activeMediaApp
      : DEFAULT_SETTINGS.activeMediaApp,
    hiddenMediaAppIds: Array.isArray(raw.hiddenMediaAppIds)
      ? raw.hiddenMediaAppIds.filter((id): id is MediaAppId =>
          isMediaAppId(id),
        )
      : DEFAULT_SETTINGS.hiddenMediaAppIds,
    shortcutGrid: {
      columns:
        rawShortcutGrid &&
        Number.isSafeInteger(rawShortcutGrid.columns)
          ? Math.min(8, Math.max(1, rawShortcutGrid.columns))
          : DEFAULT_SETTINGS.shortcutGrid.columns,
      rows:
        rawShortcutGrid &&
        Number.isSafeInteger(rawShortcutGrid.rows)
          ? Math.min(6, Math.max(1, rawShortcutGrid.rows))
          : DEFAULT_SETTINGS.shortcutGrid.rows,
    },
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

export const updateSettings = (patch: Partial<AppSettings>): AppSettings => {
  const current = getSettings();
  const next = normalizeSettings({ ...current, ...patch });
  cachedSettings = next;
  writeSettings(next);
  return next;
};

export const getSettingsPath = () => getDatabasePath();
