import { ipcMain } from "electron";
import { getQuotes } from "../services/quotesService";

export const registerQuotesIpc = () => {
  ipcMain.handle(
    "quotes:get",
    (_event, assets: string[], displayCurrencies: string[]) =>
      getQuotes(assets, displayCurrencies),
  );
};
