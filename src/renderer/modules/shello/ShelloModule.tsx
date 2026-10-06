import type { RefObject } from "react";
import { memo } from "react";

// Modulo da grade: so o espaco onde o processo principal poe a view do Shello (o Resumo,
// /?embed#resumo). O DOM aparece quando a view nao esta ali: edicao da grade, Shello fora do
// ar, modo gaveta ou fora do Electron.
export const ShelloModule = memo(function ShelloModule({
  slotRef,
  editMode,
  editPreview,
  offline,
  drawerMode,
  url,
  onRetry,
  onConfigure,
}: {
  slotRef: RefObject<HTMLDivElement | null>;
  editMode: boolean;
  editPreview: string | null;
  offline: boolean;
  drawerMode: boolean;
  url: string;
  onRetry: () => void;
  onConfigure: () => void;
}) {
  const inElectron = navigator.userAgent.includes("Electron");
  const notice = drawerMode
    ? {
        title: "Shello na gaveta lateral",
        text: "Este modulo esta configurado para abrir pela aba na borda da tela.",
      }
    : !inElectron
      ? {
          title: "Shello",
          text: "O painel carrega apenas dentro do aplicativo Electron.",
        }
      : offline
        ? {
            title: "Shello fora do ar",
            text: `Nao foi possivel abrir ${url}. Rode "shello" no terminal; o modulo tenta de novo sozinho.`,
          }
        : null;

  return (
    <div className="module-content shello-module">
      <div className="shello-slot" ref={slotRef}>
        {editMode && (
          <>
            {editPreview && (
              <img src={editPreview} alt="" className="embedded-web-preview" />
            )}
            <div className="embedded-web-edit-shield" aria-hidden="true" />
          </>
        )}
        {!editMode && notice && (
          <div className="shello-notice">
            <span className="shello-notice-mark" aria-hidden="true">
              &gt;_
            </span>
            <strong>{notice.title}</strong>
            <span>{notice.text}</span>
            <div className="shello-notice-actions">
              {offline && !drawerMode && (
                <button type="button" onClick={onRetry}>
                  Tentar de novo
                </button>
              )}
              <button type="button" onClick={onConfigure}>
                Configurar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
