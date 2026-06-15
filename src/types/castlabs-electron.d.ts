import "electron";

declare module "electron" {
  interface ComponentStatus {
    status: string;
    version: string | null;
  }

  export const components: {
    whenReady(required?: string[]): Promise<unknown[]>;
    status(): Record<string, ComponentStatus>;
    readonly WIDEVINE_CDM_ID: string;
  };
}
