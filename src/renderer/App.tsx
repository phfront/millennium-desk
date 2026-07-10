import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
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
import { ClaudeModule } from "./modules/claude";
import { QuotesModule } from "./modules/quotes";
import {
  WeatherModule,
  WeatherSettingsPanel,
} from "./modules/weather";
import { LogsPanel } from "./logs/LogsPanel";
import {
  isProfileIconImage,
  normalizeProfileIcon,
  ProfileIcon,
  readProfileIconImage,
  takeProfileEmoji,
} from "./profileIcon";
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

const PROFILE_EMOJIS = [
  "⭐", "🎯", "🚀", "💼", "🎨", "🎵", "🏠", "⚡",
  "🔥", "💡", "🎮", "📚", "🛒", "💰", "🧘", "🎬",
  "📸", "🛠", "🧪", "🌍", "❤️", "🏆", "📋", "⏰",
] as const;

const isPresetProfileIcon = (icon: string): boolean =>
  icon === "" || (PROFILE_EMOJIS as readonly string[]).includes(icon);

const isCustomTextProfileIcon = (icon: string): boolean =>
  icon !== "" && !isPresetProfileIcon(icon) && !isProfileIconImage(icon);

const ProfilePersonIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M5 20c0-3.5 3.1-6.5 7-6.5s7 3 7 6.5"/></svg>
);

const renderProfileManagerCardContent = (profile: DashboardProfile) => (
  <>
    <div className="profile-card-icon">
      <ProfileIcon
        icon={profile.icon}
        imageClassName="profile-icon-image profile-icon-image--card"
        fallback={<ProfilePersonIcon />}
      />
    </div>
    <span className="profile-card-name">{profile.name}</span>
  </>
);

const MODULE_LABELS: Record<ModuleId, string> = {
  tasks: "Tarefas",
  weather: "Ambiente",
  media: "Midia",
  system: "Sistema",
  shortcuts: "Atalhos",
  claude: "Claude",
  quotes: "Cotacoes",
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
  const [editingProfiles, setEditingProfiles] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [emojiPickerDraft, setEmojiPickerDraft] = useState("");
  const [emojiPickerError, setEmojiPickerError] = useState<string | null>(null);
  const [draggedProfileId, setDraggedProfileId] = useState<string | null>(null);
  const [dragOverProfileSlot, setDragOverProfileSlot] = useState<number | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState(false);
  const [profileDragGhost, setProfileDragGhost] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [profileDragActive, setProfileDragActive] = useState(false);
  const customEmojiInputRef = useRef<HTMLInputElement>(null);
  const profileIconImageInputRef = useRef<HTMLInputElement>(null);
  const profileDragRef = useRef({ moved: false, startX: 0, startY: 0 });
  const profileDragTargetRef = useRef<{
    profile: DashboardProfile;
    index: number;
  } | null>(null);
  const dragOverProfileSlotRef = useRef<number | null>(null);
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
    overlayOpen ||
    profileMenuOpen ||
    editingProfiles ||
    emojiPickerOpen ||
    editMode ||
    hiddenModules.includes("media") ||
    !mediaInGrid;
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
    (id: string, name: string, icon = ""): DashboardProfile => ({
      id,
      name,
      icon,
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

  const closeProfileMenu = useCallback(() => {
    setProfileMenuOpen(false);
  }, []);

  const closeEmojiPicker = useCallback(() => {
    setEmojiPickerOpen(false);
    setEmojiPickerDraft("");
    setEmojiPickerError(null);
  }, []);

  const openEmojiPicker = useCallback(() => {
    setEmojiPickerDraft(editIcon);
    setEmojiPickerError(null);
    setEmojiPickerOpen(true);
  }, [editIcon]);

  const confirmEmojiPicker = useCallback(() => {
    setEditIcon(normalizeProfileIcon(emojiPickerDraft));
    closeEmojiPicker();
  }, [closeEmojiPicker, emojiPickerDraft]);

  const handleProfileIconImageUpload = useCallback(
    async (file: File | undefined) => {
      try {
        setEmojiPickerError(null);
        const dataUrl = await readProfileIconImage(file);
        setEmojiPickerDraft(dataUrl);
      } catch (error) {
        setEmojiPickerError(
          error instanceof Error ? error.message : "Falha ao carregar imagem.",
        );
      }
    },
    [],
  );

  useEffect(() => {
    if (!emojiPickerOpen) return;
    const timer = window.setTimeout(() => {
      customEmojiInputRef.current?.focus();
    }, 80);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeEmojiPicker();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeEmojiPicker, emojiPickerOpen]);

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

  const openModuleSettings = useCallback((id: ModuleId) => {
    setModuleSettings(id);
  }, []);

  const handleShortcutCreateRequestHandled = useCallback(() => {
    setShortcutCreateSlot(null);
  }, []);

  const openShortcutSettings = useCallback(
    (slot?: number) => {
      setShortcutCreateSlot(
        typeof slot === "number" && Number.isInteger(slot) && slot >= 0
          ? slot
          : null,
      );
      openModuleSettings("shortcuts");
    },
    [openModuleSettings],
  );

  // Callbacks estaveis para nao invalidar o memo() dos modulos a cada render.
  const openTasksSettings = useCallback(
    () => openModuleSettings("tasks"),
    [openModuleSettings],
  );
  const openWeatherSettings = useCallback(
    () => openModuleSettings("weather"),
    [openModuleSettings],
  );
  const openMediaSettings = useCallback(
    () => openModuleSettings("media"),
    [openModuleSettings],
  );
  const openShortcutsSettingsDefault = useCallback(
    () => openShortcutSettings(),
    [openShortcutSettings],
  );
  const reloadMediaApp = useCallback(
    () => void window.electronControl.media.reload(),
    [],
  );
  const goHomeMediaApp = useCallback(
    () => void window.electronControl.media.goHome(),
    [],
  );

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
    if (profileId === activeProfileId) {
      setProfileMenuOpen(false);
      return;
    }
    const currentSnapshot = activeProfile
      ? buildProfileSnapshot(activeProfile.id, activeProfile.name, activeProfile.icon)
      : null;
    const nextProfiles = currentSnapshot
      ? dashboardProfiles.map((p) =>
          p.id === currentSnapshot.id ? currentSnapshot : p,
        )
      : dashboardProfiles;
    updateMediaModuleFullscreen(false);
    applyProfileState(profile);
    setProfileMenuOpen(false);
    persistProfiles(nextProfiles, profile.id, profile);
    requestAnimationFrame(syncEmbeddedWebBounds);
  };

  const createDashboardProfile = () => {
    const name = editName.trim();
    if (!name) return;
    const id = `profile-${Date.now().toString(36)}`;
    const snapshot = buildProfileSnapshot(id, name.slice(0, 40), normalizeProfileIcon(editIcon));
    const currentSnapshot = activeProfile
      ? buildProfileSnapshot(activeProfile.id, activeProfile.name, activeProfile.icon)
      : null;
    const nextProfiles = [
      ...(currentSnapshot
        ? dashboardProfiles.map((p) =>
            p.id === currentSnapshot.id ? currentSnapshot : p,
          )
        : dashboardProfiles),
      snapshot,
    ];
    persistProfiles(nextProfiles, id, snapshot);
    setEditingProfileId(null);
    setEditName("");
    setEditIcon("");
  };

  const saveProfileEdit = () => {
    if (!editingProfileId) return;
    const name = editName.trim();
    if (!name) return;
    const icon = normalizeProfileIcon(editIcon);
    const nextProfiles = dashboardProfiles.map((p) =>
      p.id === editingProfileId
        ? { ...p, name: name.slice(0, 40), icon }
        : p,
    );
    persistProfiles(nextProfiles);
    setEditingProfileId(null);
    setEditName("");
    setEditIcon("");
  };

  const deleteProfileById = (profileId: string) => {
    if (dashboardProfiles.length <= 1) return;
    const currentSnapshot =
      activeProfile && activeProfile.id !== profileId
        ? buildProfileSnapshot(activeProfile.id, activeProfile.name, activeProfile.icon)
        : null;
    const nextProfiles = (
      currentSnapshot
        ? dashboardProfiles.map((p) =>
            p.id === currentSnapshot.id ? currentSnapshot : p,
          )
        : dashboardProfiles
    ).filter((p) => p.id !== profileId);
    const nextActive = nextProfiles[0];
    if (!nextActive) return;
    applyProfileState(nextActive);
    persistProfiles(nextProfiles, nextActive.id, nextActive);
    if (editingProfileId === profileId) {
      setEditingProfileId(null);
      setEditName("");
      setEditIcon("");
      setPendingDelete(false);
    }
  };

  const reorderProfile = (profileId: string, targetIndex: number) => {
    const sourceIndex = dashboardProfiles.findIndex((p) => p.id === profileId);
    if (sourceIndex < 0 || sourceIndex === targetIndex) return;
    const next = [...dashboardProfiles];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    persistProfiles(next);
  };

  const clearProfileDrag = useCallback(() => {
    setDraggedProfileId(null);
    setDragOverProfileSlot(null);
    dragOverProfileSlotRef.current = null;
    setProfileDragGhost(null);
    setProfileDragActive(false);
    profileDragRef.current.moved = false;
    profileDragTargetRef.current = null;
  }, []);

  const getProfilePreviewAtSlot = useCallback(
    (
      slot: number,
      draggedProfile: DashboardProfile | null,
      sourceIndex: number | null,
    ): DashboardProfile | null => {
      if (
        !draggedProfile ||
        dragOverProfileSlot === null ||
        sourceIndex === null
      ) {
        return null;
      }
      if (slot !== dragOverProfileSlot || slot === sourceIndex) return null;
      return draggedProfile;
    },
    [dragOverProfileSlot],
  );

  const getProfileSlotFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      const element = document.elementFromPoint(clientX, clientY);
      const slotElement = element?.closest<HTMLElement>("[data-profile-slot]");
      if (!slotElement) return null;
      const slot = Number(slotElement.dataset.profileSlot);
      return Number.isInteger(slot) &&
        slot >= 0 &&
        slot < dashboardProfiles.length
        ? slot
        : null;
    },
    [dashboardProfiles.length],
  );

  const startProfileEdit = useCallback((profile: DashboardProfile) => {
    setEditingProfileId(profile.id);
    setEditName(profile.name);
    setEditIcon(profile.icon);
    setPendingDelete(false);
  }, []);

  const handleProfileCardPointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    profile: DashboardProfile,
    index: number,
  ) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    profileDragRef.current = {
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
    };
    setDraggedProfileId(profile.id);
    setDragOverProfileSlot(index);
    dragOverProfileSlotRef.current = index;
    setProfileDragActive(false);
    setProfileDragGhost(null);
    profileDragTargetRef.current = { profile, index };
  };

  const handleProfileCardPointerMove = (
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const { startX, startY } = profileDragRef.current;
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > 8) {
      if (!profileDragRef.current.moved) {
        profileDragRef.current.moved = true;
        setProfileDragActive(true);
      }
    }
    if (profileDragRef.current.moved) {
      setProfileDragGhost({ x: event.clientX, y: event.clientY });
    }
    const slot = getProfileSlotFromPoint(event.clientX, event.clientY);
    if (slot !== null) {
      dragOverProfileSlotRef.current = slot;
      setDragOverProfileSlot(slot);
    }
  };

  const handleProfileCardPointerUp = (
    event: PointerEvent<HTMLButtonElement>,
    profile: DashboardProfile,
    index: number,
  ) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (profileDragActive) return;
    const slot =
      getProfileSlotFromPoint(event.clientX, event.clientY) ??
      dragOverProfileSlot ??
      index;
    if (!profileDragRef.current.moved && slot === index) {
      startProfileEdit(profile);
      clearProfileDrag();
      return;
    }
    if (slot !== null) {
      reorderProfile(profile.id, slot);
    }
    clearProfileDrag();
  };

  const handleProfileCardPointerCancel = (
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    clearProfileDrag();
  };

  const confirmDeleteProfile = () => {
    if (!editingProfileId) return;
    deleteProfileById(editingProfileId);
    setPendingDelete(false);
  };

  useEffect(() => {
    if (!editingProfiles) {
      clearProfileDrag();
      setPendingDelete(false);
    }
  }, [clearProfileDrag, editingProfiles]);

  useEffect(() => {
    setPendingDelete(false);
  }, [editingProfileId]);

  useEffect(() => {
    if (!profileDragActive) return;

    const handleWindowPointerMove = (event: globalThis.PointerEvent) => {
      setProfileDragGhost({ x: event.clientX, y: event.clientY });
      const slot = getProfileSlotFromPoint(event.clientX, event.clientY);
      if (slot !== null) {
        dragOverProfileSlotRef.current = slot;
        setDragOverProfileSlot(slot);
      }
    };

    const finishWindowDrag = (event: globalThis.PointerEvent) => {
      const target = profileDragTargetRef.current;
      if (!target) return;
      const { profile, index } = target;
      const slot =
        getProfileSlotFromPoint(event.clientX, event.clientY) ??
        dragOverProfileSlotRef.current ??
        index;
      if (!profileDragRef.current.moved && slot === index) {
        startProfileEdit(profile);
      } else if (profileDragRef.current.moved && slot !== null) {
        reorderProfile(profile.id, slot);
      }
      clearProfileDrag();
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", finishWindowDrag);
    window.addEventListener("pointercancel", finishWindowDrag);
    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", finishWindowDrag);
      window.removeEventListener("pointercancel", finishWindowDrag);
    };
  }, [
    clearProfileDrag,
    getProfileSlotFromPoint,
    profileDragActive,
    startProfileEdit,
  ]);

  const updateWeatherSettings = useCallback(
    (value: {
      location?: WeatherLocation;
      temperatureUnit?: TemperatureUnit;
      savedLocations?: WeatherLocation[];
    }) => {
      const nextLocation = value.location ?? weatherLocation;
      const nextTemperatureUnit =
        value.temperatureUnit ?? weatherTemperatureUnit;
      const nextSavedLocations = value.savedLocations ?? weatherSavedLocations;
      setWeatherLocation(nextLocation);
      setWeatherTemperatureUnit(nextTemperatureUnit);
      setWeatherSavedLocations(nextSavedLocations);
      void window.electronControl.settings.update({
        weatherLocation: nextLocation,
        weatherSavedLocations: nextSavedLocations,
        weatherTemperatureUnit: nextTemperatureUnit,
      });
    },
    [weatherLocation, weatherSavedLocations, weatherTemperatureUnit],
  );

  const changeWeatherLocation = useCallback(
    (nextLocation: WeatherLocation) =>
      updateWeatherSettings({ location: nextLocation }),
    [updateWeatherSettings],
  );

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
            onConfigure={openTasksSettings}
          />
        );
      case "weather":
        return (
          <WeatherModule
            location={weatherLocation}
            savedLocations={weatherSavedLocations}
            temperatureUnit={weatherTemperatureUnit}
            onLocationChange={changeWeatherLocation}
            onConfigure={openWeatherSettings}
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
            onReload={reloadMediaApp}
            onGoHome={goHomeMediaApp}
            onConfigure={openMediaSettings}
            mediaFullscreen={mediaModuleFullscreen}
            onMediaFullscreenChange={updateMediaModuleFullscreen}
          />
        );
      case "system":
        return <SystemModule />;
      case "claude":
        return <ClaudeModule />;
      case "quotes":
        return <QuotesModule />;
      case "shortcuts":
        return (
          <ShortcutsModule
            shortcuts={shortcuts}
            gridSettings={shortcutGrid}
            onConfigure={openShortcutsSettingsDefault}
            onAddAtSlot={openShortcutSettings}
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
                closeProfileMenu();
                setSettingsOpen(true);
              }}
            />
            <div className="profile-switcher">
              <button
                type="button"
                className="profile-trigger"
                aria-expanded={profileMenuOpen}
                onClick={() => {
                  setProfileMenuOpen((open) => !open);
                }}
              >
                {activeProfile?.icon ? (
                  <span className="profile-trigger-emoji" aria-hidden="true">
                    <ProfileIcon
                      icon={activeProfile.icon}
                      imageClassName="profile-icon-image profile-icon-image--trigger"
                      fallback={<ProfilePersonIcon />}
                    />
                  </span>
                ) : (
                  <span className="profile-trigger-icon" aria-hidden="true" />
                )}
                <strong>{activeProfile?.name ?? "Padrao"}</strong>
              </button>
              {profileMenuOpen && (
                <div className="profile-menu" role="dialog" aria-label="Selecionar perfil">
                  <div className="profile-menu-header">
                    <span>Perfis</span>
                    <button
                      type="button"
                      className="profile-menu-save-btn"
                      onClick={() => {
                        closeProfileMenu();
                        setEditingProfiles(true);
                      }}
                    >
                      Editar
                    </button>
                  </div>
                  <div className="profile-card-grid">
                    {dashboardProfiles.map((profile) => (
                      <button
                        key={profile.id}
                        type="button"
                        className={
                          profile.id === activeProfileId
                            ? "profile-card active"
                            : "profile-card"
                        }
                        onClick={() => applyDashboardProfile(profile.id)}
                      >
                        <div className="profile-card-icon">
                          <ProfileIcon
                            icon={profile.icon}
                            imageClassName="profile-icon-image profile-icon-image--card"
                            fallback={<ProfilePersonIcon />}
                          />
                        </div>
                        <span className="profile-card-name">{profile.name}</span>
                      </button>
                    ))}
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

      {profileMenuOpen && (
        <button
          type="button"
          className="profile-menu-scrim"
          style={{ top: compactLayout ? 0 : HEADER_HEIGHT }}
          aria-label="Fechar selecao de perfis"
          onClick={closeProfileMenu}
        />
      )}

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

      <AnimatePresence>
        {editingProfiles && (
          <motion.div
            className="profile-config-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="profile-config-backdrop"
              onClick={() => {
                if (emojiPickerOpen) return;
                setEditingProfiles(false);
                setEditingProfileId(null);
                setEditName("");
                setEditIcon("");
                closeEmojiPicker();
              }}
            />
            <motion.div
              className="profile-config-modal profile-config-modal--manager"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              <div className="profile-config-header">
                <h3>{editingProfileId ? "Editar perfil" : "Gerenciar perfis"}</h3>
                <button
                  type="button"
                  className="profile-config-close"
                  onClick={() => {
                    setEditingProfiles(false);
                    setEditingProfileId(null);
                    setEditName("");
                    setEditIcon("");
                    closeEmojiPicker();
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
              {editingProfileId ? (
                <div className="profile-manager-edit">
                  <div className="profile-manager-edit-top">
                    <button
                      type="button"
                      className="profile-manager-edit-icon profile-manager-edit-icon-button"
                      aria-label="Escolher icone"
                      title="Escolher icone"
                      onClick={openEmojiPicker}
                    >
                      <ProfileIcon
                        icon={editIcon}
                        imageClassName="profile-icon-image profile-icon-image--edit"
                        fallback={(
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M5 20c0-3.5 3.1-6.5 7-6.5s7 3 7 6.5"/></svg>
                        )}
                      />
                    </button>
                    <input
                      className="profile-manager-name-input"
                      value={editName}
                      autoFocus
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveProfileEdit();
                        if (e.key === "Escape") {
                          if (emojiPickerOpen) {
                            closeEmojiPicker();
                            return;
                          }
                          if (pendingDelete) {
                            setPendingDelete(false);
                            return;
                          }
                          setEditingProfileId(null);
                          setEditName("");
                          setEditIcon("");
                        }
                      }}
                    />
                  </div>
                  <div className="profile-manager-edit-actions">
                    <button
                      type="button"
                      className="profile-config-cancel-btn"
                      onClick={() => {
                        closeEmojiPicker();
                        setEditingProfileId(null);
                        setEditName("");
                        setEditIcon("");
                        setPendingDelete(false);
                      }}
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      className="profile-config-save-btn"
                      onClick={saveProfileEdit}
                    >
                      Salvar
                    </button>
                  </div>
                  {dashboardProfiles.length > 1 && (
                    <div className="profile-manager-delete-zone">
                      {pendingDelete ? (
                        <div className="profile-manager-delete-confirm">
                          <p>Excluir o perfil &quot;{editName.trim() || "sem nome"}&quot;?</p>
                          <div className="profile-manager-delete-confirm-actions">
                            <button
                              type="button"
                              className="profile-config-cancel-btn"
                              onClick={() => setPendingDelete(false)}
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              className="profile-manager-delete-confirm-btn"
                              onClick={confirmDeleteProfile}
                            >
                              Sim, excluir
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="profile-manager-delete-trigger"
                          onClick={() => setPendingDelete(true)}
                        >
                          Excluir perfil
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {(() => {
                    const draggedProfile =
                      draggedProfileId !== null
                        ? (dashboardProfiles.find(
                            (profile) => profile.id === draggedProfileId,
                          ) ?? null)
                        : null;
                    const draggedProfileSourceIndex =
                      draggedProfileId !== null
                        ? dashboardProfiles.findIndex(
                            (profile) => profile.id === draggedProfileId,
                          )
                        : null;
                    const isProfileDragging =
                      profileDragActive && draggedProfileId !== null;

                    return (
                      <>
                        <div
                          className={[
                            "profile-manager-grid",
                            isProfileDragging
                              ? "profile-manager-grid--dragging"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {dashboardProfiles.map((profile, index) => {
                            const isDragging = draggedProfileId === profile.id;
                            const previewProfile = getProfilePreviewAtSlot(
                              index,
                              draggedProfile,
                              draggedProfileSourceIndex,
                            );
                            const isDropTarget =
                              isProfileDragging &&
                              dragOverProfileSlot === index &&
                              !isDragging;
                            const isSourceSlot =
                              isProfileDragging &&
                              draggedProfileSourceIndex === index;

                            return (
                              <div
                                key={profile.id}
                                data-profile-slot={index}
                                className={[
                                  "profile-manager-slot",
                                  isDropTarget
                                    ? "profile-manager-slot--drop-target"
                                    : "",
                                  isSourceSlot
                                    ? "profile-manager-slot--source"
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                              >
                                {isDragging && isProfileDragging && (
                                  <div
                                    className="profile-manager-slot-placeholder"
                                    aria-hidden="true"
                                  />
                                )}
                                <button
                                  type="button"
                                  className={[
                                    "profile-card",
                                    "profile-manager-card",
                                    profile.id === activeProfileId ? "active" : "",
                                    isDragging && isProfileDragging ? "dragging" : "",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                  onPointerDown={(event) =>
                                    handleProfileCardPointerDown(
                                      event,
                                      profile,
                                      index,
                                    )
                                  }
                                  onPointerMove={handleProfileCardPointerMove}
                                  onPointerUp={(event) =>
                                    handleProfileCardPointerUp(
                                      event,
                                      profile,
                                      index,
                                    )
                                  }
                                  onPointerCancel={handleProfileCardPointerCancel}
                                >
                                  {renderProfileManagerCardContent(profile)}
                                </button>
                                {previewProfile && (
                                  <div
                                    className="profile-card profile-manager-card profile-manager-card--preview"
                                    aria-hidden="true"
                                  >
                                    {renderProfileManagerCardContent(previewProfile)}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {profileDragGhost && draggedProfile && isProfileDragging && (
                          <div
                            className="profile-manager-drag-ghost"
                            style={{
                              left: profileDragGhost.x,
                              top: profileDragGhost.y,
                            }}
                            aria-hidden="true"
                          >
                            <div className="profile-card profile-manager-card profile-manager-card--ghost">
                              {renderProfileManagerCardContent(draggedProfile)}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                  <p className="profile-manager-hint">
                    Arraste para reordenar. Toque para editar.
                  </p>
                  <button
                    type="button"
                    className="profile-manager-add"
                    onClick={() => {
                      const id = `profile-${Date.now().toString(36)}`;
                      setEditingProfileId(id);
                      setEditName("Novo perfil");
                      setEditIcon("⭐");
                      const snapshot = buildProfileSnapshot(id, "Novo perfil", "⭐");
                      const currentSnapshot = activeProfile
                        ? buildProfileSnapshot(activeProfile.id, activeProfile.name, activeProfile.icon)
                        : null;
                      const nextProfiles = [
                        ...(currentSnapshot
                          ? dashboardProfiles.map((p) =>
                              p.id === currentSnapshot.id ? currentSnapshot : p,
                            )
                          : dashboardProfiles),
                        snapshot,
                      ];
                      persistProfiles(nextProfiles, id, snapshot);
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                    <span>Novo perfil</span>
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {emojiPickerOpen && (
          <motion.div
            className="profile-emoji-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              className="profile-emoji-backdrop"
              aria-label="Fechar selecao de emoji"
              onClick={closeEmojiPicker}
            />
            <motion.div
              className="profile-emoji-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="profile-emoji-title"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="profile-config-header">
                <h3 id="profile-emoji-title">Escolher icone</h3>
                <button
                  type="button"
                  className="profile-config-close"
                  aria-label="Fechar"
                  onClick={closeEmojiPicker}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
              <div className="profile-emoji-preview" aria-hidden="true">
                <ProfileIcon
                  icon={emojiPickerDraft}
                  imageClassName="profile-icon-image profile-icon-image--preview"
                  fallback={(
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M5 20c0-3.5 3.1-6.5 7-6.5s7 3 7 6.5"/></svg>
                  )}
                />
              </div>
              <div className="profile-config-emoji-grid">
                {PROFILE_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className={
                      emojiPickerDraft === emoji
                        ? "profile-config-emoji selected"
                        : "profile-config-emoji"
                    }
                    onClick={() => {
                      setEmojiPickerError(null);
                      setEmojiPickerDraft(emoji);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
                <label
                  className={[
                    "profile-config-emoji",
                    "profile-config-emoji-custom",
                    isCustomTextProfileIcon(emojiPickerDraft) ? "selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  title="Win + . para inserir emoji"
                >
                  <input
                    ref={customEmojiInputRef}
                    type="text"
                    className="profile-config-emoji-input"
                    aria-label="Emoji personalizado"
                    placeholder="＋"
                    value={
                      isCustomTextProfileIcon(emojiPickerDraft)
                        ? emojiPickerDraft
                        : ""
                    }
                    onChange={(event) => {
                      setEmojiPickerError(null);
                      setEmojiPickerDraft(takeProfileEmoji(event.target.value));
                    }}
                  />
                </label>
                <label
                  className={[
                    "profile-config-emoji",
                    "profile-config-emoji-image",
                    isProfileIconImage(emojiPickerDraft) ? "selected" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  title="Enviar imagem"
                >
                  <input
                    ref={profileIconImageInputRef}
                    type="file"
                    accept="image/*"
                    className="profile-config-emoji-file"
                    aria-label="Enviar imagem"
                    onChange={(event) => {
                      void handleProfileIconImageUpload(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.5"/><path d="m21 16-5.5-5.5L5 21"/></svg>
                </label>
                <button
                  type="button"
                  className={
                    emojiPickerDraft === ""
                      ? "profile-config-emoji selected"
                      : "profile-config-emoji"
                  }
                  aria-label="Sem icone"
                  title="Sem icone"
                  onClick={() => {
                    setEmojiPickerError(null);
                    setEmojiPickerDraft("");
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
              <button
                type="button"
                className="profile-config-image-upload"
                onClick={() => profileIconImageInputRef.current?.click()}
              >
                Enviar imagem personalizada
              </button>
              {emojiPickerError && (
                <p className="profile-config-emoji-error">{emojiPickerError}</p>
              )}
              <p className="profile-config-emoji-hint">
                Emoji via Win + . ou envie uma imagem (ate 2 MB)
              </p>
              <div className="profile-emoji-actions">
                <button
                  type="button"
                  className="profile-config-cancel-btn"
                  onClick={closeEmojiPicker}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="profile-config-save-btn"
                  onClick={confirmEmojiPicker}
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
