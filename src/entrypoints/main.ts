import squirrelStartup from "electron-squirrel-startup";
import { configureAppDataPath } from "../main/appPaths";

configureAppDataPath();

if (!squirrelStartup) {
  void import("./app-main");
}
