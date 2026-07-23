import React from "react";
import { createRoot } from "react-dom/client";
import type {
  AppSettings,
  CreateTagInput,
  CreateTaskInput,
  LogEntry,
  LogQuery,
  TaskExportPayload,
  TaskItem,
  TaskTag,
  UpdateTagInput,
  UpdateTaskInput,
  WeatherForecast,
  WeatherLocation,
} from "../shared/contracts";
import { isPastDateKey, todayDateKey } from "../shared/date";
import { App } from "../renderer/App";
import { SnackbarProvider } from "../renderer/components/Snackbar";
import "../renderer/styles.css";

if (!window.electronControl) {
  const browserTasks = new Map<string, TaskItem[]>();
  const browserTags: TaskTag[] = [];
  let nextTaskId = 1;
  let nextTagId = 1;

  const assertEditableDate = (date: string) => {
    if (isPastDateKey(date)) {
      throw new Error("Tarefas de datas passadas nao podem ser alteradas.");
    }
  };

  const getTaskById = (id: number) => {
    for (const tasks of browserTasks.values()) {
      const match = tasks.find((task) => task.id === id);
      if (match) return match;
    }
    throw new Error(`Tarefa ${id} nao encontrada.`);
  };

  const getTaskDate = (id: number) => {
    for (const [date, tasks] of browserTasks.entries()) {
      if (tasks.some((task) => task.id === id)) return date;
    }
    throw new Error(`Tarefa ${id} nao encontrada.`);
  };
  const BROWSER_SETTINGS_KEY = "millennium-desk:settings";

  const defaultBrowserSettings = (): AppSettings => ({
    theme: "system",
    accentColor: "#8c8dff",
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
    taskList: {
      pendingFirst: true,
      showProgress: true,
      inlineTags: true,
      denseRows: true,
      flatList: true,
      truncateText: true,
      compactHeaders: true,
      textBelow: true,
      tagsRight: false,
    },
    quoteAssets: ["USD", "EUR", "BTC"],
    quoteDisplayCurrencies: ["BRL"],
    activeProfileId: "default",
    dashboardProfiles: [
      {
        id: "default",
        name: "Padrao",
        icon: "",
        dashboardLayout: null,
        hiddenModuleIds: [],
        activeMediaApp: null,
        hiddenMediaAppIds: [],
        theme: "system",
        accentColor: "#8c8dff",
        shortcutGrid: { columns: 4, rows: 2 },
      },
    ],
  });

  const readBrowserSettings = (): AppSettings => {
    try {
      const raw = localStorage.getItem(BROWSER_SETTINGS_KEY);
      if (!raw) return defaultBrowserSettings();
      return { ...defaultBrowserSettings(), ...JSON.parse(raw) };
    } catch {
      return defaultBrowserSettings();
    }
  };

  const writeBrowserSettings = (settings: AppSettings) => {
    try {
      localStorage.setItem(BROWSER_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      // Sem espaco ou modo privado: segue em memoria nesta sessao.
    }
  };

  const browserSettings = readBrowserSettings();
  let browserShortcuts: import("../shared/contracts").ShortcutItem[] = [];

  const browserLogSubscribers = new Set<(entry: LogEntry) => void>();
  const browserLogs: LogEntry[] = [];

  const queryBrowserLogs = (query: LogQuery = {}) => {
    const categories = query.categories;
    const search = query.search?.trim().toLowerCase();

    return [...browserLogs]
      .filter((entry) => {
        if (categories?.length && !categories.includes(entry.category)) {
          return false;
        }
        if (!search) return true;
        return [entry.message, entry.category]
          .join(" ")
          .toLowerCase()
          .includes(search);
      })
      .reverse();
  };

  const browserDisplay = {
    id: 0,
    label: "Previa no navegador",
    scaleFactor: window.devicePixelRatio,
    bounds: {
      x: 0,
      y: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    workArea: {
      x: 0,
      y: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    },
    primary: true,
  };

  window.electronControl = {
    settings: {
      get: async () => ({ ...browserSettings }),
      update: async (patch) => {
        Object.assign(browserSettings, patch);
        const next = { ...browserSettings };
        writeBrowserSettings(next);
        return next;
      },
      flush: (patch) => {
        Object.assign(browserSettings, patch);
        const next = { ...browserSettings };
        writeBrowserSettings(next);
        return next;
      },
      getPath: async () => ({
        path: `browser-preview (localStorage:${BROWSER_SETTINGS_KEY})`,
      }),
    },
    tasks: {
      listByDate: async (date: string) => {
        const dated = (browserTasks.get(date) ?? []).filter(
          (task) => !task.persistent,
        );
        const persistent = [...browserTasks.entries()].flatMap(
          ([bucketDate, tasks]) =>
            tasks.filter(
              (task) =>
                task.persistent &&
                bucketDate <= date &&
                (!task.completedOn || task.completedOn >= date),
            ),
        );
        return [...dated, ...persistent];
      },
      create: async (input: CreateTaskInput) => {
        assertEditableDate(input.date);
        const text = input.text.trim();
        if (!text) throw new Error("O texto da tarefa nao pode ficar vazio.");
        const created = {
          id: nextTaskId++,
          text,
          done: false,
          tagIds: input.tagIds ?? [],
          persistent: input.persistent === true,
          completedOn: null,
        };
        browserTasks.set(input.date, [...(browserTasks.get(input.date) ?? []), created]);
        return created;
      },
      update: async (input: UpdateTaskInput) => {
        const date = getTaskDate(input.id);
        const current = getTaskById(input.id);
        if (!current.persistent) assertEditableDate(date);
        const nextPersistent = input.persistent ?? current.persistent;
        const nextDone = input.done ?? current.done;
        const updated: TaskItem = {
          ...current,
          text: input.text?.trim() || current.text,
          done: nextDone,
          tagIds: input.tagIds ?? current.tagIds,
          persistent: nextPersistent,
          completedOn:
            !nextPersistent || !nextDone
              ? null
              : (current.completedOn ?? todayDateKey()),
        };
        if (!updated.text) {
          throw new Error("O texto da tarefa nao pode ficar vazio.");
        }
        const nextDate =
          !nextPersistent && input.date !== undefined ? input.date : date;
        browserTasks.set(
          date,
          (browserTasks.get(date) ?? []).filter(
            (task) => task.id !== input.id,
          ),
        );
        browserTasks.set(nextDate, [
          ...(browserTasks.get(nextDate) ?? []),
          updated,
        ]);
        return updated;
      },
      delete: async (id: number) => {
        const date = getTaskDate(id);
        if (!getTaskById(id).persistent) assertEditableDate(date);
        browserTasks.set(
          date,
          (browserTasks.get(date) ?? []).filter((task) => task.id !== id),
        );
      },
      exportJson: async (): Promise<TaskExportPayload> => ({
        exportedAt: new Date().toISOString(),
        today: todayDateKey(),
        tasks: [...browserTasks.entries()].flatMap(([date, tasks]) =>
          tasks.map((task, index) => ({
            id: task.id,
            date,
            text: task.text,
            done: task.done,
            sortOrder: index,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            persistent: task.persistent,
            completedOn: task.completedOn,
          })),
        ),
      }),
      getDatabasePath: async () => ({
        path: "browser-preview (sem SQLite)",
      }),
    },
    tags: {
      list: async () => [...browserTags],
      create: async (input: CreateTagInput) => {
        const name = input.name.trim();
        if (!name) throw new Error("O nome da tag nao pode ficar vazio.");
        if (browserTags.some((tag) => tag.name.toLowerCase() === name.toLowerCase())) {
          throw new Error(`A tag "${name}" ja existe.`);
        }
        const created = {
          id: nextTagId++,
          name,
          color: input.color,
        };
        browserTags.push(created);
        return created;
      },
      update: async (input: UpdateTagInput) => {
        const tag = browserTags.find((entry) => entry.id === input.id);
        if (!tag) throw new Error("Tag nao encontrada.");

        const name = input.name.trim();
        if (!name) throw new Error("O nome da tag nao pode ficar vazio.");
        if (
          browserTags.some(
            (entry) =>
              entry.id !== input.id &&
              entry.name.toLowerCase() === name.toLowerCase(),
          )
        ) {
          throw new Error(`A tag "${name}" ja existe.`);
        }

        tag.name = name;
        tag.color = input.color;
        return { ...tag };
      },
      delete: async (id: number) => {
        const index = browserTags.findIndex((tag) => tag.id === id);
        if (index === -1) return;
        browserTags.splice(index, 1);
        for (const [date, tasks] of browserTasks.entries()) {
          browserTasks.set(
            date,
            tasks.map((task) => ({
              ...task,
              tagIds: task.tagIds.filter((tagId) => tagId !== id),
            })),
          );
        }
      },
    },
    system: {
      getStatus: async () => ({
        cpuPercent: 24,
        memory: {
          totalBytes: 16 * 1024 ** 3,
          usedBytes: 9.7 * 1024 ** 3,
          usedPercent: 61,
        },
        gpu: {
          available: true,
          utilizationPercent: 18,
          label: "GPU (preview)",
        },
        network: {
          downloadBytesPerSec: 4.2 * 1024 ** 2,
          uploadBytesPerSec: 512 * 1024,
        },
        disk: {
          activePercent: 7,
          readBytesPerSec: 1.8 * 1024 ** 2,
          writeBytesPerSec: 640 * 1024,
        },
      }),
    },
    quotes: {
      get: async (assets: string[], displayCurrencies: string[]) => {
        const RATES_BRL: Record<string, { bid: number; pct: number }> = {
          USD: { bid: 5.12, pct: -0.14 },
          EUR: { bid: 5.85, pct: -0.23 },
          GBP: { bid: 6.82, pct: 0.11 },
          ARS: { bid: 0.0038, pct: -0.52 },
          JPY: { bid: 0.034, pct: 0.05 },
          CHF: { bid: 6.41, pct: 0.02 },
          CAD: { bid: 3.74, pct: -0.09 },
          AUD: { bid: 3.36, pct: 0.18 },
          CNY: { bid: 0.71, pct: 0.01 },
          BTC: { bid: 331716, pct: 1.76 },
          ETH: { bid: 17350, pct: 2.31 },
          XRP: { bid: 11.2, pct: -1.02 },
          LTC: { bid: 420, pct: 0.6 },
          DOGE: { bid: 0.62, pct: 3.4 },
        };
        const { getQuoteAssetLabel } = await import("../shared/quotes");
        const displays = displayCurrencies.length
          ? displayCurrencies
          : ["BRL"];
        return {
          fetchedAt: new Date().toISOString(),
          quotes: assets.flatMap((code) => {
            const rate = RATES_BRL[code];
            if (!rate) return [];
            const currencies = displays.filter((c) => c !== code);
            const values = (currencies.length ? currencies : ["BRL"]).flatMap(
              (currency) =>
                currency === "BRL"
                  ? [{ currency, value: rate.bid }]
                  : RATES_BRL[currency]
                    ? [{ currency, value: rate.bid / RATES_BRL[currency].bid }]
                    : [],
            );
            return values.length
              ? [{
                  code,
                  label: getQuoteAssetLabel(code),
                  values,
                  pctChange: rate.pct,
                  updatedAt: "",
                }]
              : [];
          }),
        };
      },
      searchAssets: async (query: string) => {
        const { QUOTE_ASSETS } = await import("../shared/quotes");
        const extras = [
          { code: "ILS", label: "Novo Shekel Israelense" },
          { code: "MXN", label: "Peso Mexicano" },
          { code: "SOL", label: "Solana" },
          { code: "ADA", label: "Cardano" },
        ];
        const q = query.trim().toLowerCase();
        if (q.length < 2) return [];
        return [...QUOTE_ASSETS, ...extras].filter(
          (asset) =>
            asset.code.toLowerCase().includes(q) ||
            asset.label.toLowerCase().includes(q),
        );
      },
    },
    shortcuts: {
      list: async () => browserShortcuts,
      save: async (input) => {
        const existing = input.id
          ? browserShortcuts.find((item) => item.id === input.id)
          : undefined;
        const item = {
          id: existing?.id ?? Date.now(),
          name: input.name,
          type: input.type,
          target: input.target,
          args: input.args ?? [],
          workingDirectory: input.workingDirectory ?? null,
          color: input.color ?? "#8c8dff",
          color2: input.color2 ?? "#5a67ff",
          iconDataUrl: input.iconDataUrl ?? null,
          imageOnly: Boolean(input.imageOnly && input.iconDataUrl),
          confirmBeforeRun: input.confirmBeforeRun ?? false,
          sortOrder: existing?.sortOrder ?? browserShortcuts.length,
          gridSlot:
            existing?.gridSlot ??
            (input.gridSlot !== undefined &&
            Number.isInteger(input.gridSlot) &&
            input.gridSlot >= 0 &&
            !browserShortcuts.some((item) => item.gridSlot === input.gridSlot)
              ? input.gridSlot
              : browserShortcuts.length),
        };
        browserShortcuts = existing
          ? browserShortcuts.map((current) => current.id === item.id ? item : current)
          : [...browserShortcuts, item];
        return item;
      },
      delete: async (id) => {
        browserShortcuts = browserShortcuts.filter((item) => item.id !== id);
      },
      reorder: async (ids) => {
        browserShortcuts = ids.flatMap((id, index) => {
          const item = browserShortcuts.find((candidate) => candidate.id === id);
          return item ? [{ ...item, sortOrder: index }] : [];
        });
        return browserShortcuts;
      },
      place: async (id, slot) => {
        const moving = browserShortcuts.find((item) => item.id === id);
        if (!moving) return browserShortcuts;
        const occupant = browserShortcuts.find(
          (item) => item.gridSlot === slot && item.id !== id,
        );
        browserShortcuts = browserShortcuts.map((item) =>
          item.id === id
            ? { ...item, gridSlot: slot }
            : occupant && item.id === occupant.id
              ? { ...item, gridSlot: moving.gridSlot }
              : item,
        );
        return browserShortcuts;
      },
      execute: async (id) => ({
        shortcutId: id,
        started: true,
        message: "",
      }),
    },
    weather: {
      searchLocations: async (query: string): Promise<WeatherLocation[]> => [
        {
          id: 3448439,
          name: query.trim() || "São Paulo",
          region: "São Paulo",
          country: "Brasil",
          latitude: -23.5475,
          longitude: -46.63611,
          timezone: "America/Sao_Paulo",
        },
      ],
      getForecast: async (location, temperatureUnit): Promise<WeatherForecast> => {
        const now = new Date();
        const unitOffset = temperatureUnit === "fahrenheit" ? 40 : 0;
        const localHour = Number(
          new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            hour12: false,
            timeZone: location.timezone,
          }).format(now),
        );
        const isDay = localHour >= 6 && localHour < 18;
        const weatherCode = [0, 2, 61, 95][location.id % 4];
        const temperature =
          (temperatureUnit === "fahrenheit" ? 55 : 12) + (location.id % 17);
        return {
          location,
          temperatureUnit: temperatureUnit === "fahrenheit" ? "°F" : "°C",
          windSpeedUnit: temperatureUnit === "fahrenheit" ? "mph" : "km/h",
          fetchedAt: now.toISOString(),
          current: {
            time: now.toISOString(),
            temperature,
            apparentTemperature: temperature + 1,
            humidity: 68,
            precipitationProbability: 18,
            weatherCode,
            isDay,
            windSpeed: 12,
          },
          hourly: Array.from({ length: 24 }, (_, index) => ({
            time: new Date(now.getTime() + index * 3_600_000).toISOString(),
            temperature: temperature + Math.sin(index / 3) * 3,
            precipitationProbability: Math.max(5, 35 - index * 2),
            weatherCode: index > 4 && index < 8 ? 61 : 2,
          })),
          daily: Array.from({ length: 6 }, (_, index) => {
            const date = new Date(now.getTime() + index * 86_400_000);
            return {
              date: date.toISOString().slice(0, 10),
              temperatureMax: 27 + unitOffset,
              temperatureMin: 18 + unitOffset,
              precipitationProbability: 20 + index * 7,
              weatherCode: index === 2 ? 61 : 2,
              sunrise: `${date.toISOString().slice(0, 10)}T06:30`,
              sunset: `${date.toISOString().slice(0, 10)}T17:35`,
            };
          }),
        };
      },
    },
    youtube: {
      setBounds: async () => undefined,
      setVisible: async () => undefined,
      reload: async () => undefined,
      goHome: async () => undefined,
      capturePreview: async () => null,
    },
    media: {
      listApps: async () => {
        const { MEDIA_APPS } = await import("../shared/mediaApps");
        return MEDIA_APPS;
      },
      getActiveApp: async () => "youtube",
      setActiveApp: async (appId) => appId as import("../shared/mediaApps").MediaAppId,
      setBounds: async () => undefined,
      setVisible: async () => undefined,
      reload: async () => undefined,
      goHome: async () => undefined,
      capturePreview: async () => null,
      getPlaybackSupport: async () => ({
        widevine: false,
        widevineRegistered: false,
        widevineVersion: null,
        userAgent: null,
      }),
      clearSession: async () => undefined,
      openSpotifyDesktop: async () => false,
      warmApps: async () => undefined,
      showControlsMenu: async () => false,
      setFullscreenOverlayActive: async () => undefined,
      onFullscreenOverlayExit: () => () => undefined,
      onFullscreenMenuToggle: () => () => undefined,
      onControlsMenuClosed: () => () => undefined,
    },
    window: {
      toggleFullscreen: async () => false,
      isFullscreen: async () => false,
      minimize: async () => undefined,
      toggleMaximize: async () => false,
      close: async () => undefined,
      onFullscreenChanged: () => () => undefined,
      onDisplayChanged: () => () => undefined,
      moveToDisplay: async () => browserDisplay,
      moveToNextDisplay: async () => browserDisplay,
      getDisplays: async () => [browserDisplay],
    },
    logs: {
      query: async (query?: LogQuery) => queryBrowserLogs(query),
      clear: async () => {
        browserLogs.length = 0;
        return true;
      },
      onEntry: (callback) => {
        browserLogSubscribers.add(callback);
        return () => browserLogSubscribers.delete(callback);
      },
    },
  };
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SnackbarProvider>
      <App />
    </SnackbarProvider>
  </React.StrictMode>,
);
