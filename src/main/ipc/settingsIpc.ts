import { ipcMain } from "electron";
import type { AppSettings } from "../../shared/contracts";
import { syncLaunchAtStartup } from "../launchBehavior";
import { getSettings, getSettingsPath, updateSettings } from "../settings/store";

const applySettingsSideEffects = (
  patch: Partial<AppSettings>,
  settings: AppSettings,
) => {
  if ("launchAtStartup" in patch) {
    syncLaunchAtStartup(settings.launchAtStartup);
  }
};

export const registerSettingsIpc = () => {
  ipcMain.handle("settings:get", () => getSettings());

  ipcMain.handle("settings:update", (_event, patch: Partial<AppSettings>) => {
    const next = updateSettings(patch);
    applySettingsSideEffects(patch, next);
    return next;
  });

  ipcMain.on("settings:flush-sync", (event, patch: Partial<AppSettings>) => {
    const next = updateSettings(patch);
    applySettingsSideEffects(patch, next);
    event.returnValue = next;
  });

  ipcMain.handle("settings:get-path", () => ({
    path: getSettingsPath(),
  }));
};
