import { ipcMain } from "electron";
import { getQuotes } from "../services/quotesService";

export const registerQuotesIpc = () => {
  ipcMain.handle("quotes:get", () => getQuotes());
};
