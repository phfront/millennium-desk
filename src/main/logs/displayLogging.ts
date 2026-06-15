import { screen, type Display } from "electron";
import { getSettings } from "../settings/store";
import { logError } from "./logger";

const summarizeDisplay = (display: Display) => ({
  id: display.id,
  label: display.label || `Monitor ${display.id}`,
  primary: display.id === screen.getPrimaryDisplay().id,
  bounds: display.bounds,
  scaleFactor: display.scaleFactor,
});

export const registerDisplayLogging = () => {
  screen.on("display-removed", (_event, oldDisplay) => {
    const settings = getSettings();
    const preferredDisplayId =
      settings.preferredDisplay?.id ?? settings.preferredDisplayId;
    const removed = summarizeDisplay(oldDisplay);
    const remaining = screen.getAllDisplays().map(summarizeDisplay);

    logError(
      "display",
      preferredDisplayId === oldDisplay.id
        ? "Monitor do painel desconectou"
        : "Monitor desconectou",
      {
        removed,
        wasPreferred: preferredDisplayId === oldDisplay.id,
        remaining,
      },
    );
  });
};
