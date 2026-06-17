import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

/** Pasta canônica em %APPDATA% — dev e release usam o mesmo destino. */
export const APP_DATA_DIR_NAME = "millennium-desk";

const LEGACY_APP_DATA_DIRS = [
  "electron-control",
  "Electron",
  "Millennium Desk",
] as const;

const mergeDirectory = (sourceDir: string, targetDir: string) => {
  if (!fs.existsSync(sourceDir)) return;

  if (!fs.existsSync(targetDir)) {
    fs.cpSync(sourceDir, targetDir, { recursive: true });
    return;
  }

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const fromPath = path.join(sourceDir, entry.name);
    const toPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      mergeDirectory(fromPath, toPath);
      continue;
    }

    if (!fs.existsSync(toPath)) {
      fs.copyFileSync(fromPath, toPath);
    }
  }
};

const migrateLegacyUserData = (appDataRoot: string, targetDir: string) => {
  for (const legacyName of LEGACY_APP_DATA_DIRS) {
    const legacyDir = path.join(appDataRoot, legacyName);
    if (!fs.existsSync(legacyDir)) continue;
    if (path.resolve(legacyDir) === path.resolve(targetDir)) continue;

    mergeDirectory(
      path.join(legacyDir, "Partitions"),
      path.join(targetDir, "Partitions"),
    );

    const legacyDb = path.join(legacyDir, "dashboard.sqlite");
    const targetDb = path.join(targetDir, "dashboard.sqlite");
    if (fs.existsSync(legacyDb) && !fs.existsSync(targetDb)) {
      fs.copyFileSync(legacyDb, targetDb);
    }

    const legacySettings = path.join(legacyDir, "settings.json");
    const targetSettings = path.join(targetDir, "settings.json");
    if (fs.existsSync(legacySettings) && !fs.existsSync(targetSettings)) {
      fs.copyFileSync(legacySettings, targetSettings);
    }
  }
};

/**
 * Define userData antes de qualquer Session/WebContents.
 * Importar de main.ts antes de app-main.
 */
export const configureAppDataPath = (): string => {
  const appDataRoot = app.getPath("appData");
  const userDataDir = path.join(appDataRoot, APP_DATA_DIR_NAME);

  fs.mkdirSync(userDataDir, { recursive: true });
  migrateLegacyUserData(appDataRoot, userDataDir);
  app.setPath("userData", userDataDir);

  return userDataDir;
};

export const getConfiguredUserDataPath = () => app.getPath("userData");
