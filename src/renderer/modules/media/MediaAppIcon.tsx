import {
  MEDIA_APP_ICONS,
  MEDIA_APP_MONO_ICONS,
} from "../../assets/media-apps";
import type { MediaAppId } from "../../../shared/mediaApps";

export function MediaAppIcon({
  appId,
  className,
}: {
  appId: MediaAppId;
  className?: string;
}) {
  const classes = [
    className,
    MEDIA_APP_MONO_ICONS.has(appId) ? "media-dock-icon--mono" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <img
      className={classes}
      src={MEDIA_APP_ICONS[appId]}
      alt=""
      aria-hidden
      draggable={false}
    />
  );
}
