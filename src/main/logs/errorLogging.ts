import { app, type BrowserWindow } from "electron";
import { logError } from "./logger";

export const registerErrorLogging = (
  getMainWindow: () => BrowserWindow | null,
) => {
  process.on("uncaughtException", (error) => {
    logError("app", "Excecao nao tratada no processo principal", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  });

  process.on("unhandledRejection", (reason) => {
    logError("app", "Promise rejeitada sem tratamento", {
      reason:
        reason instanceof Error
          ? { name: reason.name, message: reason.message, stack: reason.stack }
          : reason,
    });
  });

  app.on("render-process-gone", (_event, webContents, details) => {
    const mainWindow = getMainWindow();
    const source =
      mainWindow && webContents.id === mainWindow.webContents.id
        ? "janela principal"
        : "superficie embutida";

    logError("app", `Processo de renderizacao encerrado (${source})`, details);
  });

  app.on("child-process-gone", (_event, details) => {
    logError("app", "Processo filho encerrado", details);
  });
};
