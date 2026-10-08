import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SoundItem } from "../../../shared/contracts";

/** Distancia entre o menu e o botao, e o respiro minimo ate a borda da janela. */
const GAP = 10;
const MARGIN = 8;

interface MenuPosition {
  left: number;
  top: number;
  /** Sem espaco acima do botao: o menu desce para baixo dele. */
  below: boolean;
  /** Onde a seta aponta, a partir da esquerda do menu (o meio do botao). */
  arrow: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/**
 * O menu do toque longo num som: aparece logo acima do botao (ou abaixo, sem espaco) com
 * Editar, Ouvir no fone e Remover. Remover pede confirmacao no proprio menu.
 */
export function SoundTileMenu({
  sound,
  anchor,
  onClose,
  onEdit,
  onPreview,
  onDelete,
}: {
  sound: SoundItem;
  anchor: DOMRect;
  onClose: () => void;
  onEdit: () => void;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  // A largura muda com a confirmacao: medir de novo
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    const center = anchor.left + anchor.width / 2;
    const left = clamp(center - width / 2, MARGIN, window.innerWidth - width - MARGIN);
    const below = anchor.top - GAP - height < MARGIN;
    setPosition({
      left,
      top: below ? anchor.bottom + GAP : anchor.top - GAP - height,
      below,
      arrow: clamp(center - left, 18, width - 18),
    });
  }, [anchor, confirming]);

  // Fora do menu, Esc, janela mudando de tamanho ou rolando: fecha
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const close = () => onCloseRef.current();
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, []);

  const portalRoot = document.querySelector<HTMLElement>(".app") ?? document.body;

  return createPortal(
    <div
      ref={menuRef}
      className={[
        "sound-tile-menu",
        position?.below ? "sound-tile-menu--below" : "",
        confirming ? "sound-tile-menu--confirm" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="menu"
      aria-label={`Ações de ${sound.name}`}
      style={
        {
          left: position?.left ?? 0,
          top: position?.top ?? 0,
          visibility: position ? "visible" : "hidden",
          "--sound-menu-arrow": `${position?.arrow ?? 0}px`,
        } as React.CSSProperties
      }
      onContextMenu={(event) => event.preventDefault()}
    >
      {confirming ? (
        <>
          <span className="sound-tile-menu-question">Remover “{sound.name}”?</span>
          <button
            type="button"
            role="menuitem"
            className="sound-tile-menu-item"
            onClick={() => setConfirming(false)}
          >
            Cancelar
          </button>
          <button
            type="button"
            role="menuitem"
            className="sound-tile-menu-item sound-tile-menu-item--danger sound-tile-menu-item--solid"
            autoFocus
            onClick={onDelete}
          >
            Remover
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            role="menuitem"
            className="sound-tile-menu-item sound-tile-menu-item--edit"
            onClick={onEdit}
          >
            Editar
          </button>
          <button
            type="button"
            role="menuitem"
            className="sound-tile-menu-item sound-tile-menu-item--preview"
            title="Toca só no fone, sem ir para o microfone"
            onClick={onPreview}
          >
            Ouvir no fone
          </button>
          <button
            type="button"
            role="menuitem"
            className="sound-tile-menu-item sound-tile-menu-item--delete sound-tile-menu-item--danger"
            onClick={() => setConfirming(true)}
          >
            Remover
          </button>
        </>
      )}
    </div>,
    portalRoot,
  );
}
