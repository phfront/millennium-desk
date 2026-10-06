import type { RefObject } from "react";
import { memo, useEffect, useRef, useState } from "react";
import type { MediaPowerState } from "../../../shared/contracts";
import { MEDIA_APPS, type MediaAppId } from "../../../shared/mediaApps";
import type { SpotifyLayoutMode } from "../../../shared/spotifyLayout";
import { MediaAppIcon } from "./MediaAppIcon";

const LONG_PRESS_MS = 500;

const toAnchor = (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
};

export const MediaModule = memo(function MediaModule({
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
  mediaFullscreen,
  onMediaFullscreenChange,
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
  mediaFullscreen: boolean;
  onMediaFullscreenChange: (fullscreen: boolean) => void;
}) {
  const dockApps = MEDIA_APPS.filter((app) => !hiddenAppIds.includes(app.id));
  const activeApp =
    dockApps.find((app) => app.id === activeAppId) ?? dockApps[0] ?? MEDIA_APPS[0];
  const [controlsMenuOpen, setControlsMenuOpen] = useState(false);
  const [powerState, setPowerState] = useState<MediaPowerState>({
    runningAppIds: [],
    activeAppPoweredOff: false,
  });
  const longPressTimer = useRef<number | null>(null);
  const longPressOrigin = useRef<{ x: number; y: number } | null>(null);
  // Toque longo abre o menu e tambem gera click/contextmenu; ignoramos ambos.
  const longPressFiredAt = useRef(0);
  const onAppChangeRef = useRef(onAppChange);
  onAppChangeRef.current = onAppChange;

  useEffect(
    () => window.electronControl.media.onControlsMenuClosed(() => {
      setControlsMenuOpen(false);
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const unsubscribe =
      window.electronControl.media.onPowerStateChanged(setPowerState);
    void window.electronControl.media.getPowerState().then((state) => {
      if (!cancelled) setPowerState(state);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(
    () =>
      window.electronControl.media.onPowerOnRequest((appId) =>
        onAppChangeRef.current(appId),
      ),
    [],
  );

  useEffect(
    () => () => {
      if (longPressTimer.current !== null) {
        window.clearTimeout(longPressTimer.current);
      }
    },
    [],
  );

  const activePoweredOff = powerState.activeAppPoweredOff;

  const openAppMenu = (appId: MediaAppId, element: HTMLElement) => {
    void window.electronControl.media.showAppMenu(appId, toAnchor(element));
  };

  const cancelLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    longPressOrigin.current = null;
  };

  const startLongPress = (
    appId: MediaAppId,
    element: HTMLElement,
    x: number,
    y: number,
  ) => {
    cancelLongPress();
    longPressOrigin.current = { x, y };
    longPressTimer.current = window.setTimeout(() => {
      longPressFiredAt.current = Date.now();
      openAppMenu(appId, element);
      cancelLongPress();
    }, LONG_PRESS_MS);
  };

  const longPressJustFired = () =>
    Date.now() - longPressFiredAt.current < 1000;

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
          {!editMode && activePoweredOff && (
            <div className="media-placeholder media-power-off">
              <MediaAppIcon appId={activeApp.id} className="media-power-off-icon" />
              <strong>{activeApp.label} desligado</strong>
              <button
                type="button"
                className="media-power-on-button"
                onClick={() => onAppChange(activeApp.id)}
              >
                Ligar
              </button>
            </div>
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
            const running = powerState.runningAppIds.includes(app.id);
            const className = [
              "media-dock-button",
              active && "active",
              active && activePoweredOff && "powered-off",
              running && !active && "running",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={app.id}
                type="button"
                className={className}
                data-app={app.id}
                aria-label={`Abrir ${app.label}`}
                aria-pressed={active}
                title={
                  running && !active
                    ? `${app.label} (ligado em segundo plano)`
                    : app.label
                }
                style={
                  {
                    "--app-accent": app.accent,
                    "--app-accent-deep": `color-mix(in srgb, ${app.accent} 72%, #000)`,
                  } as React.CSSProperties
                }
                onClick={() => {
                  if (longPressJustFired()) return;
                  onAppChange(app.id);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  if (editMode || longPressJustFired()) return;
                  openAppMenu(app.id, event.currentTarget);
                }}
                onPointerDown={(event) => {
                  if (!editMode && event.pointerType === "touch") {
                    startLongPress(
                      app.id,
                      event.currentTarget,
                      event.clientX,
                      event.clientY,
                    );
                  }
                }}
                onPointerMove={(event) => {
                  if (!longPressOrigin.current) return;
                  const dx = event.clientX - longPressOrigin.current.x;
                  const dy = event.clientY - longPressOrigin.current.y;
                  if (Math.hypot(dx, dy) > 10) cancelLongPress();
                }}
                onPointerUp={cancelLongPress}
                onPointerCancel={cancelLongPress}
              >
                <MediaAppIcon appId={app.id} className="media-dock-icon" />
              </button>
            );
          })}
          {!editMode && (
            <div className="media-controls-menu">
              <button
                type="button"
                className="media-more-button"
                aria-label="Menu da Smart TV"
                aria-expanded={controlsMenuOpen}
                aria-haspopup="menu"
                title="Menu"
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  void window.electronControl.media
                    .showControlsMenu(mediaFullscreen, {
                      x: rect.x,
                      y: rect.y,
                      width: rect.width,
                      height: rect.height,
                    })
                    .then(setControlsMenuOpen);
                }}
              />
            </div>
          )}
          {!editMode && (
            <button
              type="button"
              className="media-fullscreen-button"
              aria-label={mediaFullscreen ? "Sair do fullscreen" : "Fullscreen"}
              aria-pressed={mediaFullscreen}
              title={mediaFullscreen ? "Sair do fullscreen" : "Fullscreen"}
              onClick={() => onMediaFullscreenChange(!mediaFullscreen)}
            />
          )}
        </nav>
      </div>
    </div>
  );
});
