import { ipcMain } from "electron";
import { getClaudeUsage } from "../services/claudeUsageService";

export const registerClaudeIpc = () => {
  ipcMain.handle("claude:get-usage", () => getClaudeUsage());
};
