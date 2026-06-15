import type { MediaAppId } from "../../../shared/mediaApps";
import disneyIcon from "./disney-plus.svg";
import globoplayIcon from "./globoplay.svg";
import hboMaxIcon from "./hbo-max.png";
import netflixIcon from "./netflix.png";
import primeIcon from "./prime-video-icon.webp";
import spotifyIcon from "./spotify.png";
import twitchIcon from "./twitch.png";
import youtubeIcon from "./youtube.png";

/** Logos em `src/renderer/assets/media-apps/`. */
export const MEDIA_APP_ICONS: Record<MediaAppId, string> = {
  youtube: youtubeIcon,
  spotify: spotifyIcon,
  netflix: netflixIcon,
  prime: primeIcon,
  disney: disneyIcon,
  hbomax: hboMaxIcon,
  twitch: twitchIcon,
  globoplay: globoplayIcon,
};

/** SVGs monocromaticos que viram branco no dock colorido. */
export const MEDIA_APP_MONO_ICONS = new Set<MediaAppId>();
