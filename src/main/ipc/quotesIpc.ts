import { ipcMain } from "electron";
import { getQuotes, searchQuoteAssets } from "../services/quotesService";

export const registerQuotesIpc = () => {
  ipcMain.handle(
    "quotes:get",
    (_event, assets: string[], displayCurrencies: string[]) =>
      getQuotes(assets, displayCurrencies),
  );
  ipcMain.handle("quotes:search-assets", (_event, query: string) =>
    searchQuoteAssets(String(query ?? "")),
  );
};
