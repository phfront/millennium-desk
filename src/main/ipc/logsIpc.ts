import { BrowserWindow, ipcMain } from "electron";
import type { LogQuery } from "../../shared/logTypes";
import { clearLogs, queryLogs, subscribeLogs } from "../logs/logStore";

let mainWindowGetter: (() => BrowserWindow | null) | null = null;

export const setLogsMainWindowGetter = (
  getter: () => BrowserWindow | null,
) => {
  mainWindowGetter = getter;
};

export const registerLogsIpc = () => {
  subscribeLogs((entry) => {
    mainWindowGetter?.()?.webContents.send("logs:entry", entry);
  });

  ipcMain.handle("logs:query", (_event, query?: LogQuery) =>
    queryLogs(query ?? {}),
  );

  ipcMain.handle("logs:clear", () => {
    clearLogs();
    return true;
  });
};
