/// <reference types="vite/client" />

import type { ElectronControlApi } from "./shared/contracts";

declare global {
  interface Window {
    electronControl: ElectronControlApi;
  }
}

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;
