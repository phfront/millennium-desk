import type { RefObject } from "react";
import { MEDIA_APPS, type MediaAppId } from "../../../shared/mediaApps";
import type { SpotifyLayoutMode } from "../../../shared/spotifyLayout";
import { MediaAppIcon } from "./MediaAppIcon";

export function MediaModule({
  slotRef,
  editMode,
  editPreview,
  activeAppId,
  hiddenAppIds,
  layoutMode,
  onAppChange,
  onReload,
  onGoHome,
  onConfigure,
}: {
  slotRef: RefObject<HTMLDivElement | null>;
  editMode: boolean;
  editPreview: string | null;
  activeAppId: MediaAppId;
  hiddenAppIds: MediaAppId[];
  layoutMode: SpotifyLayoutMode;
  onAppChange: (appId: MediaAppId) => void;
  onReload: () => void;
  onGoHome: () => void;
  onConfigure: () => void;
}) {
  const dockApps = MEDIA_APPS.filter((app) => !hiddenAppIds.includes(app.id));
  const activeApp =
    dockApps.find((app) => app.id === activeAppId) ?? dockApps[0] ?? MEDIA_APPS[0];

  return (
    <div
      className={`module-content media-module media-module--${layoutMode}`}
      data-active-app={activeAppId}
    >
      <div className="module-heading media-heading">
        <div>
          <span className="eyebrow">SMART TV</span>
          <h2>{activeApp.label}</h2>
        </div>
        <div className="module-actions">
          <button
            className="module-action-icon spotify-reload-button"
            aria-label="Recarregar app de midia"
            title="Recarregar"
            onClick={onReload}
          />
          <button
            className="module-action-icon spotify-home-button"
            aria-label="Ir para o inicio do app"
            title="Inicio"
            onClick={onGoHome}
          />
          <button
            className="module-action-icon module-config-button"
            aria-label="Configurar hub de midia"
            title="Configurar"
            onClick={onConfigure}
          />
        </div>
      </div>

      <div className="media-stage">
        <div className="media-slot" ref={slotRef}>
          {editMode && (
            <>
              {editPreview && (
                <img
                  src={editPreview}
                  alt=""
                  className="embedded-web-preview"
                />
              )}
              <div className="embedded-web-edit-shield" aria-hidden="true" />
            </>
          )}
          {!navigator.userAgent.includes("Electron") && (
            <div className="media-placeholder">
              <strong>Hub de midia</strong>
              <span>
                Os apps reais carregam apenas dentro do aplicativo Electron.
              </span>
            </div>
          )}
        </div>

        <nav className="media-dock" aria-label="Apps de midia">
          {dockApps.map((app) => {
            const active = app.id === activeAppId;
            return (
              <button
                key={app.id}
                type="button"
                className={active ? "media-dock-button active" : "media-dock-button"}
                data-app={app.id}
                aria-label={`Abrir ${app.label}`}
                aria-pressed={active}
                title={app.label}
                style={
                  {
                    "--app-accent": app.accent,
                    "--app-accent-deep": `color-mix(in srgb, ${app.accent} 72%, #000)`,
                  } as React.CSSProperties
                }
                onClick={() => onAppChange(app.id)}
              >
                <MediaAppIcon appId={app.id} className="media-dock-icon" />
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
