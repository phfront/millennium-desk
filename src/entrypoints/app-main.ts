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
import { getAppIconPath } from "../main/appIcon";
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
  goHomeActiveMediaApp,
  isMediaAppRunning,
  powerOffMediaApp,
  registerMediaIpc,
  reloadActiveMediaApp,
  resolveMediaHubDevToolsTarget,
  setMediaHubActiveApp,
  setMediaRuntimeGate,
} from "../main/mediaHub";
import { disposeShello, initShello, registerShelloIpc } from "../main/shelloView";
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
import {
  getMediaAppDefinition,
  isMediaAppId,
  type MediaAppId,
} from "../shared/mediaApps";
import { registerTasksIpc } from "../main/ipc/tasksIpc";
import { registerSystemIpc } from "../main/ipc/systemIpc";
import { registerQuotesIpc } from "../main/ipc/quotesIpc";
import { stopSystemStatusWorker } from "../main/systemStatus";
import { registerShortcutsIpc } from "../main/ipc/shortcutsIpc";
import { registerSoundsIpc } from "../main/ipc/soundsIpc";
import { registerWeatherIpc } from "../main/ipc/weatherIpc";
import {
  flushSettingsStore,
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
let mediaFullscreenOverlayActive = false;
let mediaFullscreenExitOverlay: BrowserWindow | null = null;
let mediaControlsOverlay: BrowserWindow | null = null;
let mediaControlsMenuOpen = false;

type MediaMenuItem = {
  action: string;
  label: string;
  icon: "fullscreen" | "refresh" | "home" | "power";
};

const MEDIA_MENU_WIDTH = 210;
const MEDIA_MENU_ITEM_HEIGHT = 42;
const MEDIA_MENU_GAP = 6;
// Padding do body (8 + 8) + padding do .menu (8 + 8) + folga da borda.
const MEDIA_MENU_CHROME = 38;

const getMediaMenuHeight = (itemCount: number) =>
  MEDIA_MENU_CHROME +
  itemCount * MEDIA_MENU_ITEM_HEIGHT +
  Math.max(0, itemCount - 1) * MEDIA_MENU_GAP;

const escapeMenuHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const isEscapeInput = (input: Electron.Input) =>
  input.key === "Escape" || input.key === "Esc" || input.code === "Escape";

const positionMediaFullscreenExitOverlay = () => {
  if (!mainWindow || !mediaFullscreenExitOverlay) return;
  const bounds = mainWindow.getBounds();
  const size = 40;
  mediaFullscreenExitOverlay.setBounds({
    x: bounds.x + bounds.width - size,
    y: bounds.y + bounds.height - size,
    width: size,
    height: size,
  });
};

const hideMediaFullscreenExitOverlay = () => {
  mediaFullscreenExitOverlay?.hide();
};

const ensureMediaFullscreenExitOverlay = () => {
  if (!mainWindow) return null;
  if (mediaFullscreenExitOverlay && !mediaFullscreenExitOverlay.isDestroyed()) {
    return mediaFullscreenExitOverlay;
  }

  mediaFullscreenExitOverlay = new BrowserWindow({
    parent: mainWindow,
    width: 40,
    height: 40,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    skipTaskbar: true,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mediaFullscreenExitOverlay.setMenuBarVisibility(false);
  mediaFullscreenExitOverlay.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && isEscapeInput(input)) {
      event.preventDefault();
      requestMediaFullscreenOverlayExit();
    }
  });
  void mediaFullscreenExitOverlay.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(`
      <!doctype html>
      <html>
        <head>
          <style>
            html, body {
              width: 100%;
              height: 100%;
              margin: 0;
              overflow: hidden;
              background: transparent;
            }

            button {
              display: grid;
              place-items: center;
              width: 40px;
              height: 40px;
              padding: 0;
              border: 1px solid rgba(255, 255, 255, 0.24);
              border-radius: 10px 0 0 0;
              color: #fff;
              background: rgba(8, 10, 14, 0.78);
              box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28);
              cursor: pointer;
              backdrop-filter: blur(10px);
            }

            button:hover {
              background: rgba(8, 10, 14, 0.9);
            }

            button:active {
              transform: scale(0.96);
            }

            span {
              width: 17px;
              height: 17px;
              background: currentColor;
              mask-repeat: no-repeat;
              mask-position: center;
              mask-size: contain;
              mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8 3v3a2 2 0 0 1-2 2H3'/%3E%3Cpath d='M16 3v3a2 2 0 0 0 2 2h3'/%3E%3Cpath d='M8 21v-3a2 2 0 0 0-2-2H3'/%3E%3Cpath d='M16 21v-3a2 2 0 0 1 2-2h3'/%3E%3C/svg%3E");
            }
          </style>
        </head>
        <body>
          <button type="button" aria-label="Sair da tela cheia do Smart TV" title="Sair da tela cheia do Smart TV">
            <span></span>
          </button>
          <script>
            const { ipcRenderer } = require("electron");
            document.querySelector("button").addEventListener("click", () => {
              ipcRenderer.send("media:fullscreen-overlay-exit-request");
            });
          </script>
        </body>
      </html>
    `)}`,
  );
  mediaFullscreenExitOverlay.on("closed", () => {
    mediaFullscreenExitOverlay = null;
  });
  return mediaFullscreenExitOverlay;
};

function requestMediaFullscreenOverlayExit() {
  if (!mainWindow) return;
  mediaFullscreenOverlayActive = false;
  hideMediaFullscreenExitOverlay();
  mainWindow.webContents.send("media:fullscreen-overlay-exit");
}

const syncMediaFullscreenExitOverlay = () => {
  if (!mediaFullscreenOverlayActive) {
    hideMediaFullscreenExitOverlay();
    return;
  }

  const overlay = ensureMediaFullscreenExitOverlay();
  if (!overlay) return;
  positionMediaFullscreenExitOverlay();
  overlay.showInactive();
};

const hideMediaControlsOverlay = () => {
  if (!mediaControlsMenuOpen && !mediaControlsOverlay?.isVisible()) {
    return;
  }
  mediaControlsMenuOpen = false;
  mediaControlsOverlay?.hide();
  mainWindow?.webContents.send("media:controls-menu-closed");
};

const ensureMediaControlsOverlay = () => {
  if (!mainWindow) return null;
  if (mediaControlsOverlay && !mediaControlsOverlay.isDestroyed()) {
    return mediaControlsOverlay;
  }

  mediaControlsOverlay = new BrowserWindow({
    parent: mainWindow,
    width: 210,
    height: 176,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mediaControlsOverlay.setMenuBarVisibility(false);
  mediaControlsOverlay.on("blur", () => {
    window.setTimeout(() => {
      if (mediaControlsMenuOpen) {
        hideMediaControlsOverlay();
      }
    }, 0);
  });
  mediaControlsOverlay.on("closed", () => {
    mediaControlsMenuOpen = false;
    mediaControlsOverlay = null;
  });
  return mediaControlsOverlay;
};

const loadMediaControlsOverlay = (
  overlay: BrowserWindow,
  items: MediaMenuItem[],
) =>
  overlay.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(`
      <!doctype html>
      <html>
        <head>
          <style>
            * { box-sizing: border-box; }
            html, body {
              width: 100%;
              height: 100%;
              margin: 0;
              overflow: hidden;
              color: #f3f3f4;
              font-family: Inter, "Segoe UI Variable", "Segoe UI", system-ui, sans-serif;
              background: transparent;
            }
            body {
              padding: 8px;
            }
            .menu {
              display: grid;
              gap: 6px;
              width: 100%;
              height: 100%;
              padding: 8px;
              border: 1px solid rgba(255, 255, 255, 0.12);
              border-radius: 16px;
              background: rgba(24, 24, 26, 0.96);
              box-shadow: 0 18px 48px rgba(0, 0, 0, 0.42);
              backdrop-filter: blur(14px);
            }
            button {
              display: grid;
              grid-template-columns: 34px minmax(0, 1fr);
              align-items: center;
              gap: 10px;
              min-height: 42px;
              padding: 0 12px 0 8px;
              border: 0;
              border-radius: 12px;
              color: inherit;
              font: inherit;
              font-size: 14px;
              font-weight: 650;
              text-align: left;
              background: transparent;
              cursor: pointer;
            }
            button:hover {
              background: rgba(255, 255, 255, 0.08);
            }
            .icon {
              display: grid;
              place-items: center;
              width: 30px;
              height: 30px;
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 10px;
              color: #d7d7da;
              background: rgba(255, 255, 255, 0.06);
            }
            .icon::before {
              content: "";
              width: 16px;
              height: 16px;
              background: currentColor;
              mask-repeat: no-repeat;
              mask-position: center;
              mask-size: contain;
            }
            .fullscreen .icon::before {
              mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8 3H5a2 2 0 0 0-2 2v3'/%3E%3Cpath d='M16 3h3a2 2 0 0 1 2 2v3'/%3E%3Cpath d='M8 21H5a2 2 0 0 1-2-2v-3'/%3E%3Cpath d='M16 21h3a2 2 0 0 0 2-2v-3'/%3E%3C/svg%3E");
            }
            .refresh .icon::before {
              mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6v5h-5'/%3E%3Cpath d='M4 18v-5h5'/%3E%3Cpath d='M6.1 9a7 7 0 0 1 11.7-2.6L20 11'/%3E%3Cpath d='M17.9 15a7 7 0 0 1-11.7 2.6L4 13'/%3E%3C/svg%3E");
            }
            .power {
              color: #ffb4ab;
            }
            .power .icon {
              color: #ff8a80;
              border-color: rgba(255, 138, 128, 0.22);
              background: rgba(255, 138, 128, 0.1);
            }
            .power.on {
              color: #b9f6ca;
            }
            .power.on .icon {
              color: #69f0ae;
              border-color: rgba(105, 240, 174, 0.22);
              background: rgba(105, 240, 174, 0.1);
            }
            .power .icon::before {
              mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 3v9'/%3E%3Cpath d='M6.4 6.6a8 8 0 1 0 11.2 0'/%3E%3C/svg%3E");
            }
            .home .icon::before {
              mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m3 11 9-8 9 8'/%3E%3Cpath d='M5 10v10h14V10'/%3E%3Cpath d='M9 20v-6h6v6'/%3E%3C/svg%3E");
            }
          </style>
        </head>
        <body>
          <div class="menu">
            ${items
              .map(
                (item) =>
                  `<button class="${item.icon}${item.action.startsWith("power-on:") ? " on" : ""}" data-action="${escapeMenuHtml(item.action)}"><span class="icon"></span>${escapeMenuHtml(item.label)}</button>`,
              )
              .join("")}
          </div>
          <script>
            const { ipcRenderer } = require("electron");
            for (const button of document.querySelectorAll("button")) {
              button.addEventListener("click", () => {
                ipcRenderer.send("media:controls-action", button.dataset.action);
              });
            }
          </script>
        </body>
      </html>
    `)}`,
  );

const showMediaMenuOverlay = (
  items: MediaMenuItem[],
  anchor: ViewBounds,
  align: "end" | "center",
): boolean => {
  if (!mainWindow) return false;
  const overlay = ensureMediaControlsOverlay();
  if (!overlay) return false;

  if (mediaControlsMenuOpen) {
    hideMediaControlsOverlay();
    return false;
  }

  const windowBounds = mainWindow.getBounds();
  const overlayWidth = MEDIA_MENU_WIDTH;
  const overlayHeight = getMediaMenuHeight(items.length);
  const margin = 8;
  const preferredX =
    align === "center"
      ? anchor.x + anchor.width / 2 - overlayWidth / 2
      : anchor.x + anchor.width - overlayWidth;
  const x = Math.round(
    windowBounds.x +
      Math.min(
        windowBounds.width - overlayWidth - margin,
        Math.max(margin, preferredX),
      ),
  );
  const y = Math.round(
    windowBounds.y +
      Math.max(margin, anchor.y - overlayHeight - margin),
  );
  overlay.setBounds({ x, y, width: overlayWidth, height: overlayHeight });
  void loadMediaControlsOverlay(overlay, items).then(() => {
    mediaControlsMenuOpen = true;
    overlay.show();
  });
  return true;
};

const showMediaControlsOverlay = (
  mediaFullscreen: boolean,
  anchor: ViewBounds,
) =>
  showMediaMenuOverlay(
    [
      {
        action: "fullscreen",
        label: mediaFullscreen ? "Sair do fullscreen" : "Fullscreen",
        icon: "fullscreen",
      },
      { action: "refresh", label: "Refresh", icon: "refresh" },
      { action: "home", label: "Home", icon: "home" },
    ],
    anchor,
    "end",
  );

const showMediaAppMenu = (appId: MediaAppId, anchor: ViewBounds) => {
  const { label } = getMediaAppDefinition(appId);
  const item: MediaMenuItem = isMediaAppRunning(appId)
    ? { action: `power-off:${appId}`, label: `Desligar ${label}`, icon: "power" }
    : { action: `power-on:${appId}`, label: `Ligar ${label}`, icon: "power" };
  return showMediaMenuOverlay([item], anchor, "center");
};

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

  if (isEscapeInput(input) && mediaFullscreenOverlayActive) {
    event.preventDefault();
    requestMediaFullscreenOverlayExit();
    return;
  }

  const shouldToggle =
    input.key === "F11" ||
    (isEscapeInput(input) && mainWindow.isFullScreen());

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
    backgroundColor: "#0b0b0c",
    icon: getAppIconPath(),
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  try {
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
  } finally {
    // Janela ja posicionada/fullscreen antes de aparecer: evita o flash de
    // janela vazia enquanto o renderer inicializa.
    if (mainWindow && !mainWindow.isDestroyed()) {
      applyInitialWindowPresentation(mainWindow, {
        display: initialDisplay,
        launchFullscreen: settings.launchFullscreen,
      });
      mainWindow.show();
    }
  }

  initMediaHub({
    getMainWindow: () => mainWindow,
    onBeforeInputEvent: handleEmbeddedInputShortcut,
  });
  // No Shello o Esc interrompe o Claude: nao pode virar "sair da tela cheia"
  initShello({
    getMainWindow: () => mainWindow,
    onBeforeInputEvent: (event, input) => {
      if (isEscapeInput(input)) return;
      handleEmbeddedInputShortcut(event, input);
    },
  });
  if (isMediaAppId(settings.activeMediaApp)) {
    setMediaHubActiveApp(settings.activeMediaApp);
  }
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
  mainWindow.on("move", positionMediaFullscreenExitOverlay);
  mainWindow.on("resize", positionMediaFullscreenExitOverlay);

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
    mediaFullscreenExitOverlay?.destroy();
    mediaFullscreenExitOverlay = null;
    mediaControlsOverlay?.destroy();
    mediaControlsOverlay = null;
    mediaControlsMenuOpen = false;
    mediaFullscreenOverlayActive = false;
    youtubeView = null;
    disposeShello();
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

ipcMain.handle(
  "media:set-fullscreen-overlay-active",
  (_event, active: boolean) => {
    mediaFullscreenOverlayActive = active;
    syncMediaFullscreenExitOverlay();
  },
);

ipcMain.handle(
  "media:show-controls-menu",
  (_event, mediaFullscreen: boolean, anchor: ViewBounds) =>
    showMediaControlsOverlay(mediaFullscreen, anchor),
);

ipcMain.handle(
  "media:show-app-menu",
  (_event, appId: MediaAppId, anchor: ViewBounds) => {
    if (!isMediaAppId(appId)) return false;
    return showMediaAppMenu(appId, anchor);
  },
);

ipcMain.on("media:controls-action", (_event, action: string) => {
  hideMediaControlsOverlay();
  if (action === "fullscreen") {
    mainWindow?.webContents.send("media:fullscreen-menu-toggle");
    return;
  }
  if (action === "refresh") {
    reloadActiveMediaApp();
    return;
  }
  if (action === "home") {
    goHomeActiveMediaApp();
    return;
  }
  const [kind, appId] = action.split(":");
  if (!isMediaAppId(appId)) return;
  if (kind === "power-off") {
    powerOffMediaApp(appId);
    return;
  }
  if (kind === "power-on") {
    // Ligar = abrir pelo dock; o renderer e quem persiste o app ativo.
    mainWindow?.webContents.send("media:power-on-request", appId);
  }
});

ipcMain.on("media:fullscreen-overlay-exit-request", () => {
  requestMediaFullscreenOverlayExit();
});

ipcMain.handle("window:toggle-fullscreen", () => {
  if (!mainWindow) return false;
  const targetState = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(targetState);
  return targetState;
});

ipcMain.handle("window:minimize", () => {
  mainWindow?.minimize();
});

ipcMain.handle("window:toggle-maximize", () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
    return false;
  }
  mainWindow.maximize();
  return true;
});

ipcMain.handle("window:close", () => {
  mainWindow?.close();
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
  registerQuotesIpc();
  registerShortcutsIpc();
  registerSoundsIpc();
  registerMediaIpc();
  registerShelloIpc();
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
  // O preparo do Widevine (checagem/download do CDM) roda em paralelo com a
  // criacao da janela; so a criacao dos webviews de midia espera por ele.
  setMediaRuntimeGate(ensureWidevineReady());
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
  stopSystemStatusWorker();
  flushSettingsStore();
  closeDatabase();
});
