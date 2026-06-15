import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  WebContentsView,
} from "electron";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { initDatabase, closeDatabase } from "../main/database";

/** Mantém dados em %APPDATA%\electron-control após o rename do produto. */
const LEGACY_APP_DATA_DIR = "electron-control";
app.setPath(
  "userData",
  path.join(app.getPath("appData"), LEGACY_APP_DATA_DIR),
);
import {
  captureEmbeddedWebPreview,
  createEmbeddedWebView,
  getEmbeddedWebHomeUrl,
  setEmbeddedWebViewVisible,
  syncEmbeddedWebViewBounds,
  toggleEmbeddedWebDevTools,
} from "../main/embeddedWeb";
import {
  initMediaHub,
  registerMediaIpc,
  resolveMediaHubDevToolsTarget,
  setMediaHubActiveApp,
} from "../main/mediaHub";
import { registerLogsIpc, setLogsMainWindowGetter } from "../main/ipc/logsIpc";
import { registerSettingsIpc } from "../main/ipc/settingsIpc";
import {
  applyInitialWindowPresentation,
  findPreferredDisplay,
  resolvePreferredDisplay,
  syncLaunchAtStartup,
} from "../main/launchBehavior";
import { registerDisplayLogging } from "../main/logs/displayLogging";
import { registerErrorLogging } from "../main/logs/errorLogging";
import { ensureWidevineReady } from "../main/widevineComponents";
import { isMediaAppId } from "../shared/mediaApps";
import { registerTasksIpc } from "../main/ipc/tasksIpc";
import { registerSystemIpc } from "../main/ipc/systemIpc";
import { registerShortcutsIpc } from "../main/ipc/shortcutsIpc";
import { registerWeatherIpc } from "../main/ipc/weatherIpc";
import {
  getSettings,
  initSettingsStore,
  updateSettings,
} from "../main/settings/store";
import type {
  DisplayInfo,
  PreferredDisplay,
  ViewBounds,
} from "../shared/contracts";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

let mainWindow: BrowserWindow | null = null;
let youtubeView: WebContentsView | null = null;
let youtubeVisible = true;
let currentDisplayId: number | null = null;

const resolveEmbeddedDevToolsTarget = () =>
  resolveMediaHubDevToolsTarget(youtubeView, youtubeVisible);

const handleEmbeddedInputShortcut = (
  event: Electron.Event,
  input: Electron.Input,
) => {
  if (!mainWindow || input.type !== "keyDown") return;

  if (
    !app.isPackaged &&
    input.control &&
    input.shift &&
    input.key.toLowerCase() === "d"
  ) {
    event.preventDefault();
    toggleEmbeddedWebDevTools(resolveEmbeddedDevToolsTarget());
    return;
  }

  const shouldToggle =
    input.key === "F11" ||
    (input.key === "Escape" && mainWindow.isFullScreen());

  if (!shouldToggle) return;
  event.preventDefault();
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
  setTimeout(() => {
    mainWindow?.webContents.send(
      "window:fullscreen-changed",
      mainWindow.isFullScreen(),
    );
  }, 0);
};

const normalizeBounds = (bounds: ViewBounds): ViewBounds => ({
  x: Math.max(0, Math.round(bounds.x)),
  y: Math.max(0, Math.round(bounds.y)),
  width: Math.max(1, Math.round(bounds.width)),
  height: Math.max(1, Math.round(bounds.height)),
});

const toDisplayInfo = (display: Electron.Display): DisplayInfo => ({
  id: display.id,
  label: display.label || `Monitor ${display.id}`,
  scaleFactor: display.scaleFactor,
  bounds: display.bounds,
  workArea: display.workArea,
  primary: display.id === screen.getPrimaryDisplay().id,
});

const toPreferredDisplay = (display: Electron.Display): PreferredDisplay => ({
  id: display.id,
  label: display.label,
  scaleFactor: display.scaleFactor,
  bounds: display.bounds,
});

const rememberDisplay = (display: Electron.Display) =>
  updateSettings({
    preferredDisplayId: display.id,
    preferredDisplay: toPreferredDisplay(display),
  });

const moveWindowToDisplay = (display: Electron.Display) => {
  if (!mainWindow) throw new Error("Janela principal indisponivel");

  const wasFullscreen = mainWindow.isFullScreen();
  if (wasFullscreen) mainWindow.setFullScreen(false);

  const bounds = mainWindow.getBounds();
  const width = Math.min(bounds.width, display.workArea.width);
  const height = Math.min(bounds.height, display.workArea.height);
  mainWindow.setBounds({
    x: Math.round(display.workArea.x + Math.max(0, (display.workArea.width - width) / 2)),
    y: Math.round(display.workArea.y + Math.max(0, (display.workArea.height - height) / 2)),
    width,
    height,
  });
  if (wasFullscreen) mainWindow.setFullScreen(true);
  rememberDisplay(display);
  return toDisplayInfo(display);
};

const isTrustedYoutubeNavigation = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;

    return [
      "youtube.com",
      "google.com",
      "googleusercontent.com",
      "gstatic.com",
    ].some(
      (domain) =>
        url.hostname === domain || url.hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
};

const createYoutubeView = async () => {
  if (!mainWindow) return;

  youtubeView = createEmbeddedWebView({
    partition: "persist:youtube",
    homeUrl: getEmbeddedWebHomeUrl("youtube", "desktop"),
    layout: "desktop",
    isTrustedNavigation: isTrustedYoutubeNavigation,
    label: "YouTube",
    onBeforeInputEvent: handleEmbeddedInputShortcut,
  });
  youtubeView.setBounds({ x: 0, y: 0, width: 640, height: 360 });
  mainWindow.contentView.addChildView(youtubeView);
};

const createWindow = async () => {
  const settings = getSettings();
  const preferredDisplay = findPreferredDisplay(
    settings.preferredDisplay,
    settings.preferredDisplayId,
  );
  const initialDisplay =
    preferredDisplay ??
    resolvePreferredDisplay(
      settings.preferredDisplay,
      settings.preferredDisplayId,
    );
  if (
    preferredDisplay ||
    (!settings.preferredDisplay && settings.preferredDisplayId === null)
  ) {
    rememberDisplay(initialDisplay);
  }

  mainWindow = new BrowserWindow({
    x: initialDisplay.workArea.x,
    y: initialDisplay.workArea.y,
    width: Math.min(1440, initialDisplay.workArea.width),
    height: Math.min(900, initialDisplay.workArea.height),
    minWidth: 900,
    minHeight: 620,
    backgroundColor: "#090b10",
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#00000000",
      symbolColor: "#aeb7c7",
      height: 44,
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(
      path.join(
        __dirname,
        `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`,
      ),
    );
  }

  applyInitialWindowPresentation(mainWindow, {
    display: initialDisplay,
    launchFullscreen: settings.launchFullscreen,
  });

  initMediaHub({
    getMainWindow: () => mainWindow,
    onBeforeInputEvent: handleEmbeddedInputShortcut,
  });
  if (isMediaAppId(settings.activeMediaApp)) {
    setMediaHubActiveApp(settings.activeMediaApp);
  }
  await createYoutubeView();
  currentDisplayId = screen.getDisplayMatching(mainWindow.getBounds()).id;

  const notifyDisplayChange = () => {
    if (!mainWindow) return;
    const nextDisplay = screen.getDisplayMatching(mainWindow.getBounds());
    if (nextDisplay.id === currentDisplayId) return;
    currentDisplayId = nextDisplay.id;
    const info = toDisplayInfo(nextDisplay);
    rememberDisplay(nextDisplay);
    mainWindow.webContents.send("window:display-changed", info);
  };

  mainWindow.on("move", notifyDisplayChange);
  mainWindow.on("resize", notifyDisplayChange);

  const notifyFullscreen = () => {
    mainWindow?.webContents.send(
      "window:fullscreen-changed",
      mainWindow.isFullScreen(),
    );
  };

  mainWindow.on("enter-full-screen", notifyFullscreen);
  mainWindow.on("leave-full-screen", notifyFullscreen);
  mainWindow.webContents.on("before-input-event", handleEmbeddedInputShortcut);

  if (process.argv.includes("--phase0-capture")) {
    setTimeout(async () => {
      const settingsBeforeCapture = getSettings();
      try {
        if (!mainWindow) return;
        const outputDirectory = process.env.PHASE0_OUTPUT ?? process.cwd();
        const image = await mainWindow.webContents.capturePage();
        await writeFile(
          path.resolve(outputDirectory, "phase0-preview.png"),
          image.toPNG(),
        );

        if (youtubeView) {
          try {
            const youtubeImage = await youtubeView.webContents.capturePage();
            await writeFile(
              path.resolve(outputDirectory, "phase0-youtube.png"),
              youtubeImage.toPNG(),
            );
          } catch (error) {
            console.error("Falha ao capturar WebContentsView:", error);
          }
        }

        await mainWindow.webContents.executeJavaScript(`
          [...document.querySelectorAll("button")]
            .find((button) => button.textContent?.trim() === "Configuracoes")
            ?.click()
        `);
        await new Promise((resolve) => setTimeout(resolve, 500));
        const settingsImage = await mainWindow.webContents.capturePage();
        await writeFile(
          path.resolve(outputDirectory, "phase0-settings.png"),
          settingsImage.toPNG(),
        );

        await mainWindow.webContents.executeJavaScript(`
          [...document.querySelectorAll("button")]
            .find((button) => button.textContent?.trim() === "Claro")
            ?.click()
        `);
        await new Promise((resolve) => setTimeout(resolve, 300));
        const lightImage = await mainWindow.webContents.capturePage();
        await writeFile(
          path.resolve(outputDirectory, "phase0-light.png"),
          lightImage.toPNG(),
        );

        await mainWindow.webContents.executeJavaScript(`
          [...document.querySelectorAll("button")]
            .find((button) => button.textContent?.trim() === "Fechar")
            ?.click();
          [...document.querySelectorAll("button")]
            .find((button) => button.textContent?.trim() === "Editar grid")
            ?.click()
        `);
        await new Promise((resolve) => setTimeout(resolve, 500));
        const editImage = await mainWindow.webContents.capturePage();
        await writeFile(
          path.resolve(outputDirectory, "phase0-edit.png"),
          editImage.toPNG(),
        );
      } catch (error) {
        console.error("Falha no diagnostico da Fase 0:", error);
      } finally {
        updateSettings(settingsBeforeCapture);
        app.quit();
      }
    }, 3500);
  }

  mainWindow.on("closed", () => {
    youtubeView = null;
    mainWindow = null;
  });
};

ipcMain.handle("youtube:set-bounds", (_event, bounds: ViewBounds) => {
  syncEmbeddedWebViewBounds(
    mainWindow?.contentView ?? null,
    youtubeView,
    normalizeBounds(bounds),
    youtubeVisible,
  );
});

ipcMain.handle("youtube:set-visible", (_event, visible: boolean) => {
  youtubeVisible = visible;
  setEmbeddedWebViewVisible(
    mainWindow?.contentView ?? null,
    youtubeView,
    visible,
  );
});

ipcMain.handle("youtube:reload", () => youtubeView?.webContents.reload());
ipcMain.handle("youtube:go-home", () =>
  youtubeView?.webContents.loadURL(getEmbeddedWebHomeUrl("youtube", "desktop")),
);

ipcMain.handle("youtube:capture-preview", () =>
  captureEmbeddedWebPreview(youtubeView),
);

ipcMain.handle("window:toggle-fullscreen", () => {
  if (!mainWindow) return false;
  const targetState = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(targetState);
  return targetState;
});

ipcMain.handle(
  "window:is-fullscreen",
  () => mainWindow?.isFullScreen() ?? false,
);

ipcMain.handle("window:get-displays", () =>
  screen.getAllDisplays().map(toDisplayInfo),
);

ipcMain.handle("window:move-to-display", (_event, displayId: number) => {
  const display = screen
    .getAllDisplays()
    .find((candidate) => candidate.id === displayId);
  if (!display) throw new Error(`Monitor ${displayId} nao encontrado`);
  return moveWindowToDisplay(display);
});

ipcMain.handle("window:move-to-next-display", () => {
  if (!mainWindow) throw new Error("Janela principal indisponivel");

  const displays = screen.getAllDisplays();
  const current = screen.getDisplayMatching(mainWindow.getBounds());
  const currentIndex = displays.findIndex((display) => display.id === current.id);
  const next = displays[(currentIndex + 1) % displays.length];
  return moveWindowToDisplay(next);
});

app.commandLine.appendSwitch(
  "autoplay-policy",
  "no-user-gesture-required",
);
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch(
  "disable-blink-features",
  "AutomationControlled",
);

app.whenReady().then(async () => {
  const userDataPath = app.getPath("userData");
  initDatabase(userDataPath);
  initSettingsStore(userDataPath);
  registerLogsIpc();
  registerDisplayLogging();
  registerErrorLogging(() => mainWindow);
  registerSettingsIpc();
  syncLaunchAtStartup(getSettings().launchAtStartup);
  registerTasksIpc();
  registerWeatherIpc();
  registerSystemIpc();
  registerShortcutsIpc();
  registerMediaIpc();
  screen.on("display-added", () => {
    if (!mainWindow) return;
    const settings = getSettings();
    const preferredDisplay = findPreferredDisplay(
      settings.preferredDisplay,
      settings.preferredDisplayId,
    );
    if (
      preferredDisplay &&
      screen.getDisplayMatching(mainWindow.getBounds()).id !== preferredDisplay.id
    ) {
      moveWindowToDisplay(preferredDisplay);
    }
  });
  await ensureWidevineReady();
  await createWindow();
  setLogsMainWindowGetter(() => mainWindow);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  closeDatabase();
});
