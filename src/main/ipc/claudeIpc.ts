import { ipcMain } from "electron";
import { listClaudeSessions } from "../services/claudeSessionsService";

export const registerClaudeIpc = () => {
  ipcMain.handle("claude:list-sessions", () => listClaudeSessions());
};
