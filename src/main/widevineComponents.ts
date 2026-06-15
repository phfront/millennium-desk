import { components } from "electron";
import type { WebContentsView } from "electron";
import { probeWidevineSupport } from "./embeddedWeb";

export const ensureWidevineReady = async () => {
  try {
    await components.whenReady();
    const status = components.status();
    const widevine = status[components.WIDEVINE_CDM_ID];

    if (!widevine?.version) {
      console.warn(
        "[Widevine] CDM nao instalado apos components.whenReady():",
        status,
      );
      return false;
    }

    console.info(`[Widevine] CDM pronto (${widevine.version}).`);
    return true;
  } catch (error) {
    console.error("[Widevine] Falha ao preparar CDM:", error);
    return false;
  }
};

export const getWidevineComponentStatus = () => {
  const status = components.status();
  const widevine = status[components.WIDEVINE_CDM_ID];

  return {
    widevineRegistered: Boolean(widevine?.version),
    widevineVersion: widevine?.version ?? null,
    componentStatus: widevine?.status ?? null,
  };
};

export const getSpotifyPlaybackSupport = async (
  spotifyView: WebContentsView | null,
) => {
  const component = getWidevineComponentStatus();
  const emeAvailable = spotifyView
    ? await probeWidevineSupport(spotifyView.webContents)
    : false;

  return {
    widevine: component.widevineRegistered && emeAvailable,
    widevineRegistered: component.widevineRegistered,
    widevineVersion: component.widevineVersion,
    userAgent: spotifyView?.webContents.getUserAgent() ?? null,
  };
};
