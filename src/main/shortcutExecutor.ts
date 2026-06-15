import { shell } from "electron";
import { spawn } from "node:child_process";
import path from "node:path";
import type {
  ShortcutExecutionResult,
  ShortcutItem,
} from "../shared/contracts";

const spawnDetached = (
  command: string,
  args: string[],
  cwd: string | null,
) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: cwd ?? undefined,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
    child.once("error", reject);
  });

export const executeShortcut = async (
  shortcut: ShortcutItem,
): Promise<ShortcutExecutionResult> => {
  switch (shortcut.type) {
    case "url":
      await shell.openExternal(shortcut.target);
      break;
    case "file": {
      const error = await shell.openPath(shortcut.target);
      if (error) throw new Error(error);
      break;
    }
    case "app":
      if (shortcut.args.length === 0) {
        const error = await shell.openPath(shortcut.target);
        if (error) throw new Error(error);
      } else {
        await spawnDetached(
          shortcut.target,
          shortcut.args,
          shortcut.workingDirectory,
        );
      }
      break;
    case "batch":
      await spawnDetached(
        process.env.ComSpec || "cmd.exe",
        ["/d", "/s", "/c", shortcut.target, ...shortcut.args],
        shortcut.workingDirectory ?? path.dirname(shortcut.target),
      );
      break;
    case "powershell":
      await spawnDetached(
        "powershell.exe",
        [
          "-NoLogo",
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          shortcut.target,
          ...shortcut.args,
        ],
        shortcut.workingDirectory ?? path.dirname(shortcut.target),
      );
      break;
  }

  return {
    shortcutId: shortcut.id,
    started: true,
    message: "",
  };
};
