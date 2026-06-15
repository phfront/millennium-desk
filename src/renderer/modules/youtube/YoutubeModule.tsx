import type { RefObject } from "react";

export function YoutubeModule({
  slotRef,
  editMode,
  editPreview,
  onConfigure,
}: {
  slotRef: RefObject<HTMLDivElement | null>;
  editMode: boolean;
  editPreview: string | null;
  onConfigure: () => void;
}) {
  return (
    <div className="module-content youtube-module">
      <div className="module-heading">
        <div>
          <span className="eyebrow">NAVEGADOR ISOLADO</span>
          <h2>YouTube</h2>
        </div>
        <div className="module-actions">
          <button
            className="module-action-icon youtube-home-button"
            aria-label="Ir para o inicio do YouTube"
            title="Inicio"
            onClick={() => window.electronControl.youtube.goHome()}
          />
          <button
            className="module-action-icon youtube-reload-button"
            aria-label="Recarregar YouTube"
            title="Recarregar"
            onClick={() => window.electronControl.youtube.reload()}
          />
          <button
            className="module-action-icon module-config-button"
            aria-label="Configurar YouTube"
            title="Configurar"
            onClick={onConfigure}
          />
        </div>
      </div>
      <div className="youtube-slot" ref={slotRef}>
        {editMode && (
          <>
            {editPreview && (
              <img
                src={editPreview}
                alt=""
                className="embedded-web-preview"
              />
            )}
            <div
              className="embedded-web-edit-shield"
              aria-hidden="true"
            />
          </>
        )}
        {!navigator.userAgent.includes("Electron") && (
          <div className="youtube-placeholder">
            <strong>Previa do YouTube</strong>
            <span>
              O player real e carregado apenas dentro do aplicativo Electron.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
