import { ipcMain } from "electron";
import type { SaveShortcutInput } from "../../shared/contracts";
import { executeShortcut } from "../shortcutExecutor";
import {
  deleteShortcut,
  getShortcut,
  listShortcuts,
  placeShortcut,
  reorderShortcuts,
  saveShortcut,
} from "../repositories/shortcutRepository";

export const registerShortcutsIpc = () => {
  ipcMain.handle("shortcuts:list", () => listShortcuts());
  ipcMain.handle("shortcuts:save", (_event, input: SaveShortcutInput) =>
    saveShortcut(input),
  );
  ipcMain.handle("shortcuts:delete", (_event, id: number) => {
    deleteShortcut(id);
  });
  ipcMain.handle("shortcuts:reorder", (_event, ids: number[]) =>
    reorderShortcuts(ids),
  );
  ipcMain.handle("shortcuts:place", (_event, id: number, slot: number) =>
    placeShortcut(id, slot),
  );
  ipcMain.handle("shortcuts:execute", (_event, id: number) =>
    executeShortcut(getShortcut(id)),
  );
};
