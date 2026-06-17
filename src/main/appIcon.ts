import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

const ICON_BASENAME = "icon";

const resolveExistingPath = (candidates: string[]) => {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

export const getAppIconPath = (): string | undefined => {
  const extension = process.platform === "win32" ? ".ico" : ".png";
  const fileName = `${ICON_BASENAME}${extension}`;

  return (
    resolveExistingPath([
      path.join(process.resourcesPath, "assets", fileName),
      path.join(app.getAppPath(), "assets", fileName),
      path.join(__dirname, "../../assets", fileName),
      path.join(__dirname, "../../../assets", fileName),
      path.join(process.cwd(), "assets", fileName),
    ]) ?? undefined
  );
};

export const getAppIconPngPath = (): string | undefined => {
  return (
    resolveExistingPath([
      path.join(process.resourcesPath, "assets", "icon.png"),
      path.join(app.getAppPath(), "assets", "icon.png"),
      path.join(__dirname, "../../assets/icon.png"),
      path.join(__dirname, "../../../assets/icon.png"),
      path.join(process.cwd(), "assets/icon.png"),
      path.join(process.cwd(), "logo.png"),
    ]) ?? undefined
  );
};
