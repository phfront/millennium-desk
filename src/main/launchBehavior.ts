import { app, type BrowserWindow, screen, type Display } from "electron";
import type { PreferredDisplay } from "../shared/contracts";

export const syncLaunchAtStartup = (enabled: boolean) => {
  if (process.platform !== "win32" && process.platform !== "darwin") return;
  // Em dev o execPath e o electron.exe do node_modules: registrar isso na
  // inicializacao do sistema abriria o Electron puro no login.
  if (!app.isPackaged) return;

  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: [],
  });
};

export const findPreferredDisplay = (
  preferredDisplay: PreferredDisplay | null,
  preferredDisplayId: number | null,
): Display | null => {
  const displays = screen.getAllDisplays();

  if (preferredDisplay) {
    const labelMatches = displays.filter(
      (display) =>
        display.label === preferredDisplay.label && preferredDisplay.label !== "",
    );
    if (labelMatches.length === 1) return labelMatches[0];
    if (labelMatches.length > 1) {
      return (
        labelMatches.find(
          (display) =>
            display.bounds.x === preferredDisplay.bounds.x &&
            display.bounds.y === preferredDisplay.bounds.y &&
            display.bounds.width === preferredDisplay.bounds.width &&
            display.bounds.height === preferredDisplay.bounds.height,
        ) ?? labelMatches[0]
      );
    }

    const geometryMatch = displays.find(
      (display) =>
        display.bounds.x === preferredDisplay.bounds.x &&
        display.bounds.y === preferredDisplay.bounds.y &&
        display.bounds.width === preferredDisplay.bounds.width &&
        display.bounds.height === preferredDisplay.bounds.height &&
        display.scaleFactor === preferredDisplay.scaleFactor,
    );
    if (geometryMatch) return geometryMatch;

    return null;
  }

  return displays.find((display) => display.id === preferredDisplayId) ?? null;
};

export const resolvePreferredDisplay = (
  preferredDisplay: PreferredDisplay | null,
  preferredDisplayId: number | null,
): Display =>
  findPreferredDisplay(preferredDisplay, preferredDisplayId) ??
  screen.getPrimaryDisplay();

export const applyInitialWindowPresentation = (
  window: BrowserWindow,
  options: {
    display: Display;
    launchFullscreen: boolean;
  },
) => {
  const display = options.display;

  if (options.launchFullscreen) {
    window.setBounds({
      x: display.bounds.x,
      y: display.bounds.y,
      width: Math.max(640, display.bounds.width),
      height: Math.max(480, display.bounds.height),
    });
    window.setFullScreen(true);
    return;
  }

  const width = Math.min(1440, display.workArea.width);
  const height = Math.min(900, display.workArea.height);
  window.setBounds({
    x: Math.round(
      display.workArea.x +
        Math.max(0, (display.workArea.width - width) / 2),
    ),
    y: Math.round(
      display.workArea.y +
        Math.max(0, (display.workArea.height - height) / 2),
    ),
    width,
    height,
  });
  window.maximize();
};
