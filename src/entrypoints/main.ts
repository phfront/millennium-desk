import squirrelStartup from "electron-squirrel-startup";

if (!squirrelStartup) {
  void import("./app-main");
}
