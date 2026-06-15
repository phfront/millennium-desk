import { ipcMain } from "electron";
import { getSystemStatus } from "../systemStatus";

export const registerSystemIpc = () => {
  ipcMain.handle("system:get-status", () => getSystemStatus());
};
