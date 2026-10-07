import { ipcMain } from "electron";
import type { SaveSoundInput } from "../../shared/contracts";
import {
  deleteSound,
  listSounds,
  placeSound,
  readSoundAudio,
  saveSound,
} from "../repositories/soundRepository";

export const registerSoundsIpc = () => {
  ipcMain.handle("sounds:list", () => listSounds());
  ipcMain.handle("sounds:save", (_event, input: SaveSoundInput) =>
    saveSound(input),
  );
  ipcMain.handle("sounds:delete", (_event, id: number) => {
    deleteSound(id);
  });
  ipcMain.handle("sounds:place", (_event, id: number, slot: number) =>
    placeSound(id, slot),
  );
  ipcMain.handle("sounds:read-audio", (_event, id: number) =>
    readSoundAudio(id),
  );
};
