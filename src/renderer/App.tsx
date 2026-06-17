import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type {
  AppSettings,
  DashboardProfile,
  DisplayInfo,
  SaveShortcutInput,
  ShortcutItem,
  ShortcutGridSettings,
  TemperatureUnit,
  TaskTag,
  ThemePreference,
  WeatherLocation,
} from "../shared/contracts";
import {
  DEFAULT_MEDIA_APP_ID,
  isMediaAppId,
  MEDIA_APPS,
  resolveActiveMediaApp,
  type MediaAppId,
} from "../shared/mediaApps";
import {
  inferSpotifyLayoutForWidth,
  resolveSpotifyLayoutForWidth,
  type SpotifyLayoutMode,
} from "../shared/spotifyLayout";
import {
  GridDivider,
  ModuleCard,
  type ModuleId,
} from "./dashboard/ModuleCard";
import {
  appendModule,
  calculateLayout,
  collectModulesInLayout,
  createInitialLayoutTree,
  GRID_MIN_VIEWPORT_HEIGHT,
  migrateLegacyLayoutModules,
  placeModule,
  removeModule,
  updateSplitRatio,
  type DropPlacement,
  type LayoutNode,
} from "./dashboard/layoutTree";
import { useResolvedTheme } from "./hooks/useResolvedTheme";
import {
  TaskModuleSettingsPanel,
  TasksModule,
  type TaskModuleSettings,
} from "./modules/tasks";
import { MediaModule, MediaModuleSettingsPanel } from "./modules/media";
import { SystemModule } from "./modules/system";
import {
  WeatherModule,
  WeatherSettingsPanel,
} from "./modules/weather";
import { LogsPanel } from "./logs/LogsPanel";
import {
  ShortcutsModule,
  ShortcutsSettingsPanel,
} from "./modules/shortcuts";

const HEADER_HEIGHT = 56;
const DEFAULT_PROFILE_ID = "default";
const ACCENT_PRESETS = [
  "#8c8dff",
  "#4f9cf9",
  "#21b58f",
  "#e15f9a",
  "#f08a4b",
] as const;

const MODULE_LABELS: Record<ModuleId, string> = {
  tasks: "Tarefas",
  weather: "Ambiente",
  media: "Midia",
  system: "Sistema",
  shortcuts: "Atalhos",
};
const MODULE_IDS = Object.keys(MODULE_LABELS) as ModuleId[];

const isAccentPreset = (
  color: string,
): color is (typeof ACCENT_PRESETS)[number] =>
  (ACCENT_PRESETS as readonly string[]).includes(color);

const DEFAULT_WEATHER_LOCATION: WeatherLocation = {
  id: 3448439,
  name: "São Paulo",
  region: "São Paulo",
  country: "Brasil",
  latitude: -23.5475,
  longitude: -46.63611,
  timezone: "America/Sao_Paulo",
};

export function App() {
  const reduceMotion = useReducedMotion();
  const [theme, setTheme] = useState<ThemePreference | null>(null);
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const resolvedTheme = useResolvedTheme(theme ?? "system");
  const [editMode, setEditMode] = useState(false);
  const [mediaEditPreview, setMediaEditPreview] = useState<string | null>(null);
  const [activeMediaApp, setActiveMediaApp] = useState<MediaAppId>(
    DEFAULT_MEDIA_APP_ID,
  );
  const [hiddenMediaAppIds, setHiddenMediaAppIds] = useState<MediaAppId[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [moduleSettings, setModuleSettings] = useState<ModuleId | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [activeProfileId, setActiveProfileId] = useState(DEFAULT_PROFILE_ID);
  const [dashboardProfiles, setDashboardProfiles] = useState<DashboardProfile[]>([]);
  const [draggedModule, setDraggedModule] = useState<ModuleId | null>(null);
  const [dropTarget, setDropTarget] = useState<ModuleId | null>(null);
  const [dropPlacement, setDropPlacement] = useState<DropPlacement | null>(
    null,
  );
  const [hiddenModules, setHiddenModules] = useState<ModuleId[]>([]);
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>([]);
  const [shortcutGrid, setShortcutGrid] = useState<ShortcutGridSettings>({
    columns: 4,
    rows: 2,
  });
  const shortcutGridRef = useRef(shortcutGrid);
  const [shortcutCreateSlot, setShortcutCreateSlot] = useState<number | null>(
    null,
  );
  const [fullscreen, setFullscreen] = useState(false);
  const [mediaModuleFullscreen, setMediaModuleFullscreen] = useState(false);
  const [launchAtStartup, setLaunchAtStartup] = useState(false);
  const [launchFullscreen, setLaunchFullscreen] = useState(true);
  const [taskSettings, setTaskSettings] = useState<TaskModuleSettings>({
    pendingFirst: true,
    showProgress: true,
  });
  const [taskTags, setTaskTags] = useState<TaskTag[]>([]);
  const [taskTagsError, setTaskTagsError] = useState<string | null>(null);
  const [weatherLocation, setWeatherLocation] = useState<WeatherLocation>(
    DEFAULT_WEATHER_LOCATION,
  );
  const [weatherSavedLocations, setWeatherSavedLocations] = useState<
    WeatherLocation[]
  >([]);
  const [weatherTemperatureUnit, setWeatherTemperatureUnit] =
    useState<TemperatureUnit>("celsius");
  const [display, setDisplay] = useState<DisplayInfo | null>(null);
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [layoutTree, setLayoutTree] = useState<LayoutNode | null>(
    createInitialLayoutTree,
  );
  const [gridSettingsLoaded, setGridSettingsLoaded] = useState(false);
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: Math.max(
      GRID_MIN_VIEWPORT_HEIGHT,
      window.innerHeight - HEADER_HEIGHT,
    ),
  });
  const mediaSlotRef = useRef<HTMLDivElement>(null);
  const [mediaLayoutMode, setMediaLayoutMode] = useState<SpotifyLayoutMode>(
    () => inferSpotifyLayoutForWidth(window.innerWidth * 0.25),
  );
  const mediaLayoutRef = useRef<SpotifyLayoutMode>(mediaLayoutMode);
  const activeMediaAppRef = useRef(activeMediaApp);
  const hiddenMediaAppIdsRef = useRef(hiddenMediaAppIds);
  activeMediaAppRef.current = activeMediaApp;
  hiddenMediaAppIdsRef.current = hiddenMediaAppIds;
  shortcutGridRef.current = shortcutGrid;
  const viewportRef = useRef({
    width: window.innerWidth,
    height: Math.max(
      GRID_MIN_VIEWPORT_HEIGHT,
      window.innerHeight - HEADER_HEIGHT,
    ),
  });
  const layoutTreeRef = useRef(layoutTree);
  const hiddenModulesRef = useRef(hiddenModules);
  const themeRef = useRef(theme);
  const accentColorRef = useRef(accentColor);
  const skipNextGridSaveRef = useRef(true);
  layoutTreeRef.current = layoutTree;
  hiddenModulesRef.current = hiddenModules;
  themeRef.current = theme;
  accentColorRef.current = accentColor;
  const overlayOpen = settingsOpen || logsOpen || moduleSettings !== null;
  const compactLayout = fullscreen || editMode || mediaModuleFullscreen;
  const calculatedLayout = calculateLayout(layoutTree, {
    x: 0,
    y: 0,
    width: viewport.width,
    height: viewport.height,
  });
  const renderedLayouts = calculatedLayout.modules;
  const mediaInGrid = renderedLayouts.some((layout) => layout.id === "media");
  const mediaSurfaceHidden =
    overlayOpen || editMode || hiddenModules.includes("media") || !mediaInGrid;
  const embeddedLayoutSignature = renderedLayouts
    .map(
      (module) =>
        `${module.id}:${module.x},${module.y},${module.width},${module.height}`,
    )
    .join("|");
  const activeProfile =
    dashboardProfiles.find((profile) => profile.id === activeProfileId) ??
    dashboardProfiles[0] ??
    null;

  const buildProfileSnapshot = useCallback(
    (id: string, name: string): DashboardProfile => ({
      id,
      name,
      dashboardLayout: layoutTreeRef.current,
      hiddenModuleIds: hiddenModulesRef.current,
      activeMediaApp: activeMediaAppRef.current,
      hiddenMediaAppIds: hiddenMediaAppIdsRef.current,
      theme: themeRef.current ?? "system",
      accentColor: accentColorRef.current ?? ACCENT_PRESETS[0],
      shortcutGrid: shortcutGridRef.current,
    }),
    [],
  );

  const applyProfileState = useCallback((profile: DashboardProfile) => {
    setTheme(profile.theme);
    setAccentColor(profile.accentColor);
    setShortcutGrid(profile.shortcutGrid);

    const nextHiddenMediaApps = profile.hiddenMediaAppIds.filter((id) =>
      isMediaAppId(id),
    );
    setHiddenMediaAppIds(nextHiddenMediaApps);

    const nextActiveApp = resolveActiveMediaApp(
      isMediaAppId(profile.activeMediaApp)
        ? profile.activeMediaApp
        : DEFAULT_MEDIA_APP_ID,
      nextHiddenMediaApps,
    );
    setActiveMediaApp(nextActiveApp);
    void window.electronControl.media.setActiveApp(nextActiveApp);

    const validHiddenModules = profile.hiddenModuleIds
      .map((id) => (id === "spotify" ? "media" : id))
      .filter((id): id is ModuleId => MODULE_IDS.includes(id as ModuleId));
    let nextLayout = migrateLegacyLayoutModules(
      profile.dashboardLayout ?? createInitialLayoutTree(),
    );
    for (const id of validHiddenModules) {
      nextLayout = removeModule(nextLayout, id);
    }
    const modulesInLayout = new Set(collectModulesInLayout(nextLayout));
    const missingModules = MODULE_IDS.filter(
      (id) => !modulesInLayout.has(id) && !validHiddenModules.includes(id),
    );

    setHiddenModules([...validHiddenModules, ...missingModules]);
    setLayoutTree(nextLayout);
    skipNextGridSaveRef.current = true;
  }, []);

  useEffect(() => {
    void window.electronControl.settings
      .get()
      .then((settings) => {
        setTheme(settings.theme);
        setAccentColor(settings.accentColor);
        setDashboardProfiles(settings.dashboardProfiles);
        setActiveProfileId(settings.activeProfileId);
        setLaunchAtStartup(settings.launchAtStartup);
        setLaunchFullscreen(settings.launchFullscreen);
        const activeLocation =
          settings.weatherLocation ?? DEFAULT_WEATHER_LOCATION;
        setWeatherLocation(activeLocation);
        setWeatherSavedLocations(
          settings.weatherSavedLocations.length > 0
            ? settings.weatherSavedLocations
            : [activeLocation],
        );
        setWeatherTemperatureUnit(settings.weatherTemperatureUnit);
        setShortcutGrid(settings.shortcutGrid);
        const validHiddenModules = settings.hiddenModuleIds
          .map((id) => (id === "spotify" ? "media" : id))
          .filter((id): id is ModuleId => MODULE_IDS.includes(id as ModuleId));
        let nextLayout: LayoutNode | null = migrateLegacyLayoutModules(
          settings.dashboardLayout ?? createInitialLayoutTree(),
        );
        const nextHiddenMediaApps = (settings.hiddenMediaAppIds ?? []).filter(
          (id): id is MediaAppId => isMediaAppId(id),
        );
        setHiddenMediaAppIds(nextHiddenMediaApps);
        const initialMediaApp = resolveActiveMediaApp(
          isMediaAppId(settings.activeMediaApp)
            ? settings.activeMediaApp
            : DEFAULT_MEDIA_APP_ID,
          nextHiddenMediaApps,
        );
        setActiveMediaApp(initialMediaApp);
        void window.electronControl.media.setActiveApp(initialMediaApp);
        for (const id of validHiddenModules) {
          nextLayout = removeModule(nextLayout, id);
        }
        const modulesInLayout = new Set(collectModulesInLayout(nextLayout));
        const missingModules = MODULE_IDS.filter(
          (id) => !modulesInLayout.has(id) && !validHiddenModules.includes(id),
        );
        setHiddenModules([...validHiddenModules, ...missingModules]);
        setLayoutTree(nextLayout);
        skipNextGridSaveRef.current = true;
        setGridSettingsLoaded(true);
      })
      .catch((error) => {
        console.error("Falha ao carregar configuracoes:", error);
        setTheme("system");
        setAccentColor(ACCENT_PRESETS[0]);
        setDashboardProfiles([
          buildProfileSnapshot(DEFAULT_PROFILE_ID, "Padrao"),
        ]);
        setActiveProfileId(DEFAULT_PROFILE_ID);
        skipNextGridSaveRef.current = true;
        setGridSettingsLoaded(true);
      });
  }, [buildProfileSnapshot]);

  const buildPersistedSettingsPatch = useCallback(
    (): Partial<AppSettings> => ({
      theme: themeRef.current ?? undefined,
      accentColor: accentColorRef.current ?? undefined,
      dashboardLayout: layoutTreeRef.current,
      hiddenModuleIds: hiddenModulesRef.current,
    }),
    [],
  );

  const flushGridSettings = useCallback(() => {
    if (!gridSettingsLoaded) return;
    void window.electronControl.settings.update(buildPersistedSettingsPatch());
  }, [buildPersistedSettingsPatch, gridSettingsLoaded]);

  const flushGridSettingsSync = useCallback(() => {
    if (!gridSettingsLoaded) return;
    window.electronControl.settings.flush(buildPersistedSettingsPatch());
  }, [buildPersistedSettingsPatch, gridSettingsLoaded]);

  useEffect(() => {
    if (!gridSettingsLoaded) return;
    if (skipNextGridSaveRef.current) {
      skipNextGridSaveRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      flushGridSettings();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [
    flushGridSettings,
    gridSettingsLoaded,
    hiddenModules,
    layoutTree,
  ]);

  useEffect(() => {
    const handleUnload = () => flushGridSettingsSync();
    window.addEventListener("pagehide", handleUnload);
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("pagehide", handleUnload);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [flushGridSettingsSync]);

  useEffect(() => {
    void window.electronControl.tags
      .list()
      .then(setTaskTags)
      .catch((error) => {
        setTaskTagsError(
          error instanceof Error ? error.message : "Falha ao carregar tags.",
        );
      });
  }, []);

  const loadShortcuts = useCallback(async () => {
    setShortcuts(await window.electronControl.shortcuts.list());
  }, []);

  useEffect(() => {
    void loadShortcuts();
  }, [loadShortcuts]);

  const saveShortcut = async (input: SaveShortcutInput) => {
    await window.electronControl.shortcuts.save(input);
    await loadShortcuts();
  };

  const deleteShortcut = async (id: number) => {
    await window.electronControl.shortcuts.delete(id);
    await loadShortcuts();
  };

  const placeShortcut = async (id: number, slot: number) => {
    setShortcuts(await window.electronControl.shortcuts.place(id, slot));
  };

  const updateShortcutGrid = async (value: ShortcutGridSettings) => {
    const normalized = {
      columns: Math.min(8, Math.max(1, value.columns || 1)),
      rows: Math.min(6, Math.max(1, value.rows || 1)),
    };
    const capacity = normalized.columns * normalized.rows;
    const validSlots = new Set(
      shortcuts
        .map((shortcut) => shortcut.gridSlot)
        .filter((slot) => slot >= 0 && slot < capacity),
    );
    const displaced = shortcuts.filter(
      (shortcut) =>
        shortcut.gridSlot < 0 ||
        shortcut.gridSlot >= capacity ||
        shortcuts.some(
          (candidate) =>
            candidate.id !== shortcut.id &&
            candidate.gridSlot === shortcut.gridSlot &&
            candidate.id < shortcut.id,
        ),
    );
    const freeSlots = Array.from({ length: capacity }, (_, slot) => slot).filter(
      (slot) => !validSlots.has(slot),
    );

    for (const shortcut of displaced) {
      const slot = freeSlots.shift();
      if (slot === undefined) break;
      await window.electronControl.shortcuts.place(shortcut.id, slot);
    }

    setShortcutGrid(normalized);
    await window.electronControl.settings.update({ shortcutGrid: normalized });
    await loadShortcuts();
  };

  const createTaskTag = (name: string, color: string) => {
    setTaskTagsError(null);
    void window.electronControl.tags
      .create({ name, color })
      .then((created) => setTaskTags((current) => [...current, created]))
      .catch((error) => {
        setTaskTagsError(
          error instanceof Error ? error.message : "Falha ao criar tag.",
        );
      });
  };

  const deleteTaskTag = (id: number) => {
    setTaskTagsError(null);
    void window.electronControl.tags
      .delete(id)
      .then(() => setTaskTags((current) => current.filter((tag) => tag.id !== id)))
      .catch((error) => {
        setTaskTagsError(
          error instanceof Error ? error.message : "Falha ao excluir tag.",
        );
      });
  };

  const updateTaskTag = (id: number, name: string, color: string) => {
    setTaskTagsError(null);
    void window.electronControl.tags
      .update({ id, name, color })
      .then((updated) =>
        setTaskTags((current) =>
          current.map((tag) => (tag.id === updated.id ? updated : tag)),
        ),
      )
      .catch((error) => {
        setTaskTagsError(
          error instanceof Error ? error.message : "Falha ao editar tag.",
        );
      });
  };

  const persistAppearance = useCallback(
    (patch: Partial<{ theme: ThemePreference; accentColor: string }>) => {
      if (patch.theme !== undefined) setTheme(patch.theme);
      if (patch.accentColor !== undefined) setAccentColor(patch.accentColor);
      void window.electronControl.settings.update(patch).catch((error) => {
        console.error("Falha ao salvar aparencia:", error);
      });
    },
    [],
  );

  const resolveMediaSlot = useCallback(() => {
    if (mediaInGrid) return mediaSlotRef.current;
    return null;
  }, [mediaInGrid]);

  const syncMediaBounds = useCallback(() => {
    const element = resolveMediaSlot();
    if (!element || mediaSurfaceHidden) return;
    const rect = element.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const layoutMode =
      activeMediaAppRef.current === "spotify"
        ? resolveSpotifyLayoutForWidth(rect.width, mediaLayoutRef.current)
        : "desktop";
    if (layoutMode !== mediaLayoutRef.current) {
      mediaLayoutRef.current = layoutMode;
      setMediaLayoutMode(layoutMode);
    }
    void window.electronControl.media.setBounds({
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      layoutMode:
        activeMediaAppRef.current === "spotify" ? layoutMode : undefined,
    });
  }, [mediaSurfaceHidden, resolveMediaSlot]);

  const syncEmbeddedWebBounds = useCallback(() => {
    syncMediaBounds();
  }, [syncMediaBounds]);

  useLayoutEffect(() => {
    syncEmbeddedWebBounds();
    const observer = new ResizeObserver(syncEmbeddedWebBounds);
    const mediaSlot = resolveMediaSlot();
    if (mediaSlot) observer.observe(mediaSlot);
    window.addEventListener("resize", syncEmbeddedWebBounds);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncEmbeddedWebBounds);
    };
  }, [resolveMediaSlot, syncEmbeddedWebBounds]);

  useLayoutEffect(() => {
    if (mediaSurfaceHidden) return;

    const firstFrame = requestAnimationFrame(() => {
      syncEmbeddedWebBounds();
      requestAnimationFrame(syncEmbeddedWebBounds);
    });
    const settledTimer = window.setTimeout(syncEmbeddedWebBounds, 220);

    return () => {
      cancelAnimationFrame(firstFrame);
      window.clearTimeout(settledTimer);
    };
  }, [
    editMode,
    embeddedLayoutSignature,
    fullscreen,
    mediaModuleFullscreen,
    mediaSurfaceHidden,
    syncEmbeddedWebBounds,
  ]);

  useEffect(() => {
    void window.electronControl.media.setVisible(!mediaSurfaceHidden);
    if (!mediaSurfaceHidden) requestAnimationFrame(syncMediaBounds);
  }, [mediaSurfaceHidden, syncMediaBounds]);

  const changeMediaApp = useCallback((appId: MediaAppId) => {
    setActiveMediaApp(appId);
    void window.electronControl.media.setActiveApp(appId);
    void window.electronControl.settings.update({ activeMediaApp: appId });
    requestAnimationFrame(syncMediaBounds);
  }, [syncMediaBounds]);

  const toggleMediaAppVisibility = useCallback(
    (appId: MediaAppId, visible: boolean) => {
      setHiddenMediaAppIds((current) => {
        const nextHidden = visible
          ? current.filter((id) => id !== appId)
          : current.includes(appId)
            ? current
            : [...current, appId];

        const nextActive = resolveActiveMediaApp(
          activeMediaAppRef.current,
          nextHidden,
        );
        if (nextActive !== activeMediaAppRef.current) {
          setActiveMediaApp(nextActive);
          void window.electronControl.media.setActiveApp(nextActive);
        }

        void window.electronControl.settings.update({
          hiddenMediaAppIds: nextHidden,
          activeMediaApp: nextActive,
        });

        if (visible) {
          void window.electronControl.media.warmApps();
        }

        return nextHidden;
      });
    },
    [],
  );

  const updateMediaModuleFullscreen = useCallback((active: boolean) => {
    void window.electronControl.media.setFullscreenOverlayActive(active);
    setMediaModuleFullscreen(active);
  }, []);

  useEffect(() => {
    void Promise.all([
      window.electronControl.window.getDisplays(),
      window.electronControl.settings.get(),
    ]).then(([availableDisplays, settings]) => {
      setDisplays(availableDisplays);
      setDisplay(
        availableDisplays.find(
          (item) =>
            item.id ===
            (settings.preferredDisplay?.id ?? settings.preferredDisplayId),
        ) ??
          availableDisplays.find((item) => item.primary) ??
          availableDisplays[0] ??
          null,
      );
    });

    const unsubscribe =
      window.electronControl.window.onFullscreenChanged(setFullscreen);
    const unsubscribeDisplay =
      window.electronControl.window.onDisplayChanged(setDisplay);
    void window.electronControl.window.isFullscreen().then(setFullscreen);
    const confirmationTimer = window.setTimeout(() => {
      void window.electronControl.window.isFullscreen().then(setFullscreen);
    }, 250);

    return () => {
      window.clearTimeout(confirmationTimer);
      unsubscribe();
      unsubscribeDisplay();
    };
  }, []);

  useEffect(() => {
    const fitLayoutsToViewport = () => {
      const previous = viewportRef.current;
      const next = {
        width: window.innerWidth,
        height: Math.max(
          GRID_MIN_VIEWPORT_HEIGHT,
          window.innerHeight - (compactLayout ? 0 : HEADER_HEIGHT),
        ),
      };

      if (previous.width === next.width && previous.height === next.height) {
        return;
      }

      viewportRef.current = next;
      setViewport(next);
    };

    window.addEventListener("resize", fitLayoutsToViewport);
    fitLayoutsToViewport();
    return () => window.removeEventListener("resize", fitLayoutsToViewport);
  }, [compactLayout]);

  useEffect(() => {
    void window.electronControl.media.setFullscreenOverlayActive(
      mediaModuleFullscreen,
    );
  }, [mediaModuleFullscreen]);

  useEffect(() => {
    return window.electronControl.media.onFullscreenOverlayExit(() => {
      setMediaModuleFullscreen(false);
    });
  }, []);

  useEffect(() => {
    return window.electronControl.media.onFullscreenMenuToggle(() => {
      updateMediaModuleFullscreen(!mediaModuleFullscreen);
    });
  }, [mediaModuleFullscreen, updateMediaModuleFullscreen]);

  useEffect(() => {
    if (!mediaModuleFullscreen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Esc" || event.code === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        updateMediaModuleFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mediaModuleFullscreen, updateMediaModuleFullscreen]);

  const openModuleSettings = (id: ModuleId) => {
    setModuleSettings(id);
  };

  const handleShortcutCreateRequestHandled = useCallback(() => {
    setShortcutCreateSlot(null);
  }, []);

  const openShortcutSettings = (slot?: number) => {
    setShortcutCreateSlot(
      typeof slot === "number" && Number.isInteger(slot) && slot >= 0
        ? slot
        : null,
    );
    openModuleSettings("shortcuts");
  };

  const enterEditMode = async () => {
    updateMediaModuleFullscreen(false);
    const mediaPreview = hiddenModules.includes("media")
      ? null
      : await window.electronControl.media.capturePreview();
    setMediaEditPreview(mediaPreview);
    setEditMode(true);
  };

  const exitEditMode = () => {
    window.electronControl.settings.flush({
      dashboardLayout: layoutTree,
      hiddenModuleIds: hiddenModules,
    });
    setEditMode(false);
    setMediaEditPreview(null);
  };

  const hideModule = (id: ModuleId) => {
    if (id === "media") {
      updateMediaModuleFullscreen(false);
    }
    setDraggedModule(null);
    setDropTarget(null);
    setModuleSettings((current) => (current === id ? null : current));
    setLayoutTree((current) => removeModule(current, id));
    setHiddenModules((current) => {
      return current.includes(id) ? current : [...current, id];
    });
  };

  const showModule = (id: ModuleId) => {
    setLayoutTree((current) => appendModule(current, id));
    setHiddenModules((current) => {
      return current.filter((moduleId) => moduleId !== id);
    });
  };

  const moveModule = (
    source: ModuleId,
    target: ModuleId,
    placement: DropPlacement,
  ) => {
    setLayoutTree((current) =>
      current ? placeModule(current, source, target, placement) : current,
    );
  };

  const persistProfiles = (
    nextProfiles: DashboardProfile[],
    nextActiveProfileId = activeProfileId,
    snapshot?: DashboardProfile,
  ) => {
    setDashboardProfiles(nextProfiles);
    setActiveProfileId(nextActiveProfileId);
    void window.electronControl.settings.update({
      dashboardProfiles: nextProfiles,
      activeProfileId: nextActiveProfileId,
      ...(snapshot
        ? {
            theme: snapshot.theme,
            accentColor: snapshot.accentColor,
            dashboardLayout: snapshot.dashboardLayout,
            hiddenModuleIds: snapshot.hiddenModuleIds,
            activeMediaApp: snapshot.activeMediaApp,
            hiddenMediaAppIds: snapshot.hiddenMediaAppIds,
            shortcutGrid: snapshot.shortcutGrid,
          }
        : {}),
    });
  };

  const applyDashboardProfile = (profileId: string) => {
    const profile = dashboardProfiles.find((item) => item.id === profileId);
    if (!profile) return;
    updateMediaModuleFullscreen(false);
    applyProfileState(profile);
    setProfileMenuOpen(false);
    persistProfiles(dashboardProfiles, profile.id, profile);
    requestAnimationFrame(syncEmbeddedWebBounds);
  };

  const saveActiveDashboardProfile = () => {
    const current = activeProfile ?? dashboardProfiles[0];
    if (!current) return;
    const snapshot = buildProfileSnapshot(current.id, current.name);
    const nextProfiles = dashboardProfiles.map((profile) =>
      profile.id === current.id ? snapshot : profile,
    );
    persistProfiles(nextProfiles, current.id, snapshot);
    setProfileMenuOpen(false);
  };

  const createDashboardProfile = () => {
    const name = window.prompt("Nome do novo perfil", "Novo perfil")?.trim();
    if (!name) return;
    const id = `profile-${Date.now().toString(36)}`;
    const snapshot = buildProfileSnapshot(id, name.slice(0, 40));
    const nextProfiles = [...dashboardProfiles, snapshot];
    persistProfiles(nextProfiles, id, snapshot);
    setProfileMenuOpen(false);
  };

  const deleteActiveDashboardProfile = () => {
    const current = activeProfile;
    if (!current || dashboardProfiles.length <= 1) return;
    const confirmed = window.confirm(`Excluir o perfil "${current.name}"?`);
    if (!confirmed) return;
    const nextProfiles = dashboardProfiles.filter(
      (profile) => profile.id !== current.id,
    );
    const nextActive = nextProfiles[0];
    if (!nextActive) return;
    applyProfileState(nextActive);
    persistProfiles(nextProfiles, nextActive.id, nextActive);
    setProfileMenuOpen(false);
  };

  const updateWeatherSettings = (value: {
    location?: WeatherLocation;
    temperatureUnit?: TemperatureUnit;
    savedLocations?: WeatherLocation[];
  }) => {
    const nextLocation = value.location ?? weatherLocation;
    const nextTemperatureUnit = value.temperatureUnit ?? weatherTemperatureUnit;
    const nextSavedLocations = value.savedLocations ?? weatherSavedLocations;
    setWeatherLocation(nextLocation);
    setWeatherTemperatureUnit(nextTemperatureUnit);
    setWeatherSavedLocations(nextSavedLocations);
    void window.electronControl.settings.update({
      weatherLocation: nextLocation,
      weatherSavedLocations: nextSavedLocations,
      weatherTemperatureUnit: nextTemperatureUnit,
    });
  };

  const renderModuleContent = (
    id: ModuleId,
    options: {
      mediaSlotRef: typeof mediaSlotRef;
      editMode: boolean;
      mediaEditPreview: string | null;
    },
  ) => {
    switch (id) {
      case "tasks":
        return (
          <TasksModule
            settings={taskSettings}
            tags={taskTags}
            onConfigure={() => openModuleSettings("tasks")}
          />
        );
      case "weather":
        return (
          <WeatherModule
            location={weatherLocation}
            savedLocations={weatherSavedLocations}
            temperatureUnit={weatherTemperatureUnit}
            onLocationChange={(nextLocation) =>
              updateWeatherSettings({ location: nextLocation })
            }
            onConfigure={() => openModuleSettings("weather")}
          />
        );
      case "media":
        return (
          <MediaModule
            slotRef={options.mediaSlotRef}
            editMode={options.editMode}
            editPreview={options.mediaEditPreview}
            activeAppId={activeMediaApp}
            hiddenAppIds={hiddenMediaAppIds}
            layoutMode={mediaLayoutMode}
            onAppChange={changeMediaApp}
            onReload={() => void window.electronControl.media.reload()}
            onGoHome={() => void window.electronControl.media.goHome()}
            onConfigure={() => openModuleSettings("media")}
            mediaFullscreen={mediaModuleFullscreen}
            onMediaFullscreenChange={updateMediaModuleFullscreen}
          />
        );
      case "system":
        return <SystemModule />;
      case "shortcuts":
        return (
          <ShortcutsModule
            shortcuts={shortcuts}
            gridSettings={shortcutGrid}
            onConfigure={() => openShortcutSettings()}
            onAddAtSlot={(slot) => openShortcutSettings(slot)}
          />
        );
    }
  };

  if (theme === null || accentColor === null) {
    return (
      <main className="app" data-theme={resolvedTheme}>
        <div className="module-body">
          <div className="empty-tasks">Carregando preferencias...</div>
        </div>
      </main>
    );
  }

  return (
    <main
      className={[
        "app",
        fullscreen && "fullscreen",
        mediaModuleFullscreen && "media-module-fullscreen",
        editMode && "editing-layout",
      ]
        .filter(Boolean)
        .join(" ")}
      data-theme={resolvedTheme}
      style={{
        "--accent": accentColor,
        "--accent-soft": `${accentColor}24`,
      } as React.CSSProperties}
    >
      {!compactLayout && (
        <header className="topbar topbar-v2">
          <div className="topbar-brand">
            <span className="topbar-mark">
              <img src="icon.png" alt="" />
            </span>
            <div>
              <h1>Millennium Desk</h1>
            </div>
          </div>

          <div className="topbar-actions">
            <button
              className="topbar-icon-button topbar-fullscreen-button"
              type="button"
              aria-label="Tela cheia"
              title="Tela cheia"
              onClick={async () => {
                const value =
                  await window.electronControl.window.toggleFullscreen();
                setFullscreen(value);
              }}
            >
            </button>
            <button
              className="topbar-icon-button topbar-edit-button"
              type="button"
              aria-label="Editar grid"
              title="Editar grid"
              onClick={() => void enterEditMode()}
            />
            <button
              className="topbar-icon-button topbar-settings-button"
              type="button"
              aria-label="Ajustes"
              title="Ajustes"
              onClick={() => {
                setSettingsOpen(true);
              }}
            />
            <div className="profile-switcher">
              <button
                type="button"
                className="profile-trigger"
                aria-expanded={profileMenuOpen}
                onClick={() => setProfileMenuOpen((open) => !open)}
              >
                <span className="profile-trigger-icon" aria-hidden="true" />
                <strong>{activeProfile?.name ?? "Padrao"}</strong>
              </button>
              {profileMenuOpen && (
                <div className="profile-menu">
                  <div className="profile-menu-list">
                    {dashboardProfiles.map((profile) => (
                      <button
                        key={profile.id}
                        type="button"
                        className={
                          profile.id === activeProfileId ? "selected" : ""
                        }
                        onClick={() => applyDashboardProfile(profile.id)}
                      >
                        <span>{profile.name}</span>
                        {profile.id === activeProfileId && <strong>Ativo</strong>}
                      </button>
                    ))}
                  </div>
                  <div className="profile-menu-actions">
                    <button type="button" onClick={saveActiveDashboardProfile}>
                      Salvar atual
                    </button>
                    <button type="button" onClick={createDashboardProfile}>
                      Novo perfil
                    </button>
                    <button
                      type="button"
                      disabled={dashboardProfiles.length <= 1}
                      onClick={deleteActiveDashboardProfile}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="window-controls" aria-label="Controles da janela">
            <button
              type="button"
              className="window-control-button window-minimize-button"
              aria-label="Minimizar"
              title="Minimizar"
              onClick={() => void window.electronControl.window.minimize()}
            />
            <button
              type="button"
              className="window-control-button window-maximize-button"
              aria-label="Maximizar ou restaurar"
              title="Maximizar ou restaurar"
              onClick={() =>
                void window.electronControl.window.toggleMaximize()
              }
            />
            <button
              type="button"
              className="window-control-button window-close-button"
              aria-label="Fechar"
              title="Fechar"
              onClick={() => void window.electronControl.window.close()}
            />
          </div>
        </header>
      )}
      {false && !compactLayout && <header className="topbar">
        <div>
          <span className="eyebrow">MILLENNIUM</span>
          <h1>Millennium Desk</h1>
        </div>
        <div className="topbar-actions">
          {display && (
            <span className="display-chip">
              {display.label} · {Math.round(display.scaleFactor * 100)}%
            </span>
          )}
          <button
            className="button"
            onClick={async () => {
              const value =
                await window.electronControl.window.toggleFullscreen();
              setFullscreen(value);
            }}
          >
            Tela cheia
          </button>
          <button className="button" onClick={() => void enterEditMode()}>
            Editar grid
          </button>
          <button
            className="icon-button"
            onClick={() => {
              setSettingsOpen(false);
              setModuleSettings(null);
              setLogsOpen(true);
            }}
          >
            Erros
          </button>
          <button
            className="icon-button"
            onClick={() => {
              setLogsOpen(false);
              setSettingsOpen(true);
            }}
          >
            Configuracoes
          </button>
        </div>
      </header>}

      <section className={editMode ? "canvas editing" : "canvas"}>
        {renderedLayouts.map((layout) => (
          <ModuleCard
            key={layout.id}
            layout={layout}
            editMode={editMode}
            reduceMotion={Boolean(reduceMotion)}
            draggedModule={draggedModule}
            dropTarget={dropTarget}
            dropPlacement={dropPlacement}
            onDragStateChange={(source, target, placement) => {
              setDraggedModule(source);
              setDropTarget(target);
              setDropPlacement(placement);
            }}
            onPlace={moveModule}
            onHide={hideModule}
            onConfigure={openModuleSettings}
            expanded={layout.id === "media" && mediaModuleFullscreen}
          >
            {renderModuleContent(layout.id, {
              mediaSlotRef,
              editMode,
              mediaEditPreview,
            })}
          </ModuleCard>
        ))}
        {editMode &&
          calculatedLayout.dividers.map((divider) => (
            <GridDivider
              key={divider.path}
              divider={divider}
              onChange={(ratio) =>
                setLayoutTree((current) =>
                  current
                    ? updateSplitRatio(current, divider.path, ratio)
                    : current,
                )
              }
            />
          ))}
        {editMode && (
          <aside className="hidden-modules-tray">
            <button className="edit-tray-done" onClick={exitEditMode}>
              Concluir
            </button>
            {hiddenModules.length > 0 && (
              <div className="hidden-modules-section">
                <div className="hidden-modules-list">
                  {hiddenModules.map((id) => (
                    <button key={id} onClick={() => showModule(id)}>
                      <span>+</span>
                      {MODULE_LABELS[id]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </aside>
        )}
      </section>

      <AnimatePresence>
        {overlayOpen && (
          <>
            <motion.button
              aria-label="Fechar painel"
              className="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setSettingsOpen(false);
                setLogsOpen(false);
                setModuleSettings(null);
              }}
            />
            <motion.aside
              className={logsOpen ? "settings-panel logs-panel" : "settings-panel"}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            >
              {logsOpen ? (
                <LogsPanel
                  onClose={() => {
                    setLogsOpen(false);
                  }}
                />
              ) : (
                <>
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">
                    {moduleSettings ? "MODULO" : "GERAL"}
                  </span>
                  <h2>
                    {moduleSettings === "tasks"
                      ? "Tarefas"
                      : moduleSettings === "weather"
                        ? "Clima"
                        : moduleSettings === "media"
                          ? "Midia"
                          : moduleSettings === "shortcuts"
                            ? "Atalhos"
                          : "Configuracoes"}
                  </h2>
                </div>
                <button
                  type="button"
                  className="modal-close-button"
                  aria-label="Fechar"
                  title="Fechar"
                  onClick={() => {
                    setSettingsOpen(false);
                    setModuleSettings(null);
                  }}
                />
              </div>

              {!moduleSettings && <section className="setting-group">
                <h3>Aparencia</h3>
                <div className="segmented">
                  {(["system", "light", "dark"] as const).map((value) => (
                    <button
                      key={value}
                      className={theme === value ? "selected" : ""}
                      onClick={() => persistAppearance({ theme: value })}
                    >
                      {value === "system"
                        ? "Sistema"
                        : value === "light"
                          ? "Claro"
                          : "Escuro"}
                    </button>
                  ))}
                </div>
                <div className="accent-settings">
                  <span>Cor de destaque</span>
                  <div className="accent-options">
                    {ACCENT_PRESETS.map((color) => (
                      <button
                        key={color}
                        aria-label={`Usar cor ${color}`}
                        className={accentColor === color ? "selected" : ""}
                        style={{ backgroundColor: color }}
                        onClick={() => persistAppearance({ accentColor: color })}
                      />
                    ))}
                    <label
                      className={`custom-accent${isAccentPreset(accentColor) ? "" : " selected"}`}
                      style={
                        isAccentPreset(accentColor)
                          ? undefined
                          : { backgroundColor: accentColor }
                      }
                    >
                      <input
                        aria-label="Escolher cor personalizada"
                        type="color"
                        value={accentColor}
                        onChange={(event) =>
                          persistAppearance({ accentColor: event.target.value })
                        }
                      />
                      {isAccentPreset(accentColor) ? "+" : null}
                    </label>
                  </div>
                </div>
              </section>}

              {!moduleSettings && <section className="setting-group">
                <h3>Janela</h3>
                <button
                  className="setting-action"
                  onClick={async () => {
                    const value =
                      await window.electronControl.window.toggleFullscreen();
                    setFullscreen(value);
                  }}
                >
                  <span>Tela cheia agora</span>
                  <strong>{fullscreen ? "Ativa" : "Desativada"}</strong>
                </button>
                <button
                  className="setting-action"
                  onClick={() => {
                    const next = !launchAtStartup;
                    setLaunchAtStartup(next);
                    void window.electronControl.settings.update({
                      launchAtStartup: next,
                    });
                  }}
                >
                  <span>Iniciar com o Windows</span>
                  <strong>{launchAtStartup ? "Ativo" : "Desativado"}</strong>
                </button>
                <button
                  className="setting-action"
                  onClick={() => {
                    const next = !launchFullscreen;
                    setLaunchFullscreen(next);
                    void window.electronControl.settings.update({
                      launchFullscreen: next,
                    });
                  }}
                >
                  <span>Abrir em tela cheia</span>
                  <strong>{launchFullscreen ? "Ativo" : "Desativado"}</strong>
                </button>
                <p className="muted">
                  O monitor e lembrado automaticamente ao mover o painel ou
                  escolher abaixo.
                </p>
                <label className="display-selector">
                  <span>Monitor do painel</span>
                  <select
                    value={display?.id ?? ""}
                    onChange={async (event) => {
                      const next =
                        await window.electronControl.window.moveToDisplay(
                          Number(event.target.value),
                        );
                      setDisplay(next);
                      requestAnimationFrame(syncEmbeddedWebBounds);
                    }}
                  >
                    {displays.map((item, index) => (
                      <option key={item.id} value={item.id}>
                        {item.label || `Monitor ${index + 1}`} ·{" "}
                        {item.workArea.width}×{item.workArea.height} ·{" "}
                        {Math.round(item.scaleFactor * 100)}%
                      </option>
                    ))}
                  </select>
                </label>
              </section>}

              {!moduleSettings && <section className="setting-group">
                <h3>Diagnostico</h3>
                <p className="muted">
                  Este painel valida tema, movimento, toque, DPI e superficies
                  nativas antes da arquitetura definitiva.
                </p>
              </section>}

              {moduleSettings === "tasks" && (
                <TaskModuleSettingsPanel
                  settings={taskSettings}
                  tags={taskTags}
                  tagError={taskTagsError}
                  onChange={setTaskSettings}
                  onCreateTag={createTaskTag}
                  onUpdateTag={updateTaskTag}
                  onDeleteTag={deleteTaskTag}
                />
              )}

              {moduleSettings === "media" && (
                <>
                  <MediaModuleSettingsPanel
                    hiddenAppIds={hiddenMediaAppIds}
                    onToggleApp={toggleMediaAppVisibility}
                  />
                  <section className="setting-group">
                    <h3>Sessao e DRM</h3>
                    <p className="muted">
                      Cada app usa uma sessao isolada e permanece logado ao
                      trocar pelo dock. Netflix, Disney+ e similares exigem
                      Widevine com assinatura VMP de producao (`npm run
                      evs:sign-dev` em dev ou `npm run package:signed` no
                      instalador).
                    </p>
                  </section>
                  <section className="setting-group">
                    <button
                      className="setting-action"
                      onClick={() =>
                        void window.electronControl.media.clearSession(
                          activeMediaApp,
                        )
                      }
                    >
                      <span>Limpar sessao do app ativo</span>
                      <strong>
                        {MEDIA_APPS.find((app) => app.id === activeMediaApp)
                          ?.label ?? "App"}
                      </strong>
                    </button>
                    <button
                      className="setting-action"
                      onClick={() =>
                        void window.electronControl.media.clearSession("spotify")
                      }
                    >
                      <span>Limpar sessao do Spotify</span>
                      <strong>Reset</strong>
                    </button>
                    <button
                      className="setting-action"
                      onClick={() =>
                        void window.electronControl.media.openSpotifyDesktop()
                      }
                    >
                      <span>Abrir app desktop</span>
                      <strong>Spotify</strong>
                    </button>
                  </section>
                </>
              )}
              {moduleSettings === "weather" && (
                <WeatherSettingsPanel
                  location={weatherLocation}
                  savedLocations={weatherSavedLocations}
                  temperatureUnit={weatherTemperatureUnit}
                  onChange={updateWeatherSettings}
                />
              )}
              {moduleSettings === "shortcuts" && (
                <ShortcutsSettingsPanel
                  shortcuts={shortcuts}
                  gridSettings={shortcutGrid}
                  onSave={saveShortcut}
                  onDelete={deleteShortcut}
                  onPlace={placeShortcut}
                  onGridSettingsChange={updateShortcutGrid}
                  createAtSlot={shortcutCreateSlot}
                  onCreateRequestHandled={handleShortcutCreateRequestHandled}
                />
              )}
                </>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
