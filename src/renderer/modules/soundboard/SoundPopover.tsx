import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Distancia entre o balao e o botao, e o respiro minimo ate a borda da janela. */
const GAP = 10;
const MARGIN = 8;

interface PopoverPosition {
  left: number;
  top: number;
  /** Sem espaco acima do botao: o balao desce para baixo dele. */
  below: boolean;
  /** Onde a seta aponta, a partir da esquerda do balao (o meio do botao). */
  arrow: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Balao logo acima de um botao da grade dos Sons (ou abaixo, sem espaco), com a seta no meio
 * dele. Fecha ao tocar fora, no Esc e se a janela mudar de tamanho ou rolar. O conteudo pode
 * mudar de tamanho (a confirmacao do menu, por exemplo): o balao se reposiciona sozinho.
 */
export function SoundPopover({
  anchor,
  className,
  label,
  onClose,
  children,
}: {
  anchor: DOMRect;
  className: string;
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<PopoverPosition | null>(null);

  useLayoutEffect(() => {
    const popover = popoverRef.current;
    if (!popover) return;
    const place = () => {
      const width = popover.offsetWidth;
      const height = popover.offsetHeight;
      const center = anchor.left + anchor.width / 2;
      const left = clamp(center - width / 2, MARGIN, window.innerWidth - width - MARGIN);
      const below = anchor.top - GAP - height < MARGIN;
      setPosition({
        left,
        top: below ? anchor.bottom + GAP : anchor.top - GAP - height,
        below,
        arrow: clamp(center - left, 18, width - 18),
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(popover);
    return () => observer.disconnect();
  }, [anchor]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const close = () => onCloseRef.current();
    const handlePointerDown = (event: PointerEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    // A lista do catalogo rola por dentro: so a rolagem de fora fecha
    const handleScroll = (event: Event) => {
      if (!popoverRef.current?.contains(event.target as Node)) close();
    };
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  const portalRoot = document.querySelector<HTMLElement>(".app") ?? document.body;

  return createPortal(
    <div
      ref={popoverRef}
      className={[
        "sound-popover",
        className,
        position?.below ? "sound-popover--below" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="menu"
      aria-label={label}
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
      {children}
    </div>,
    portalRoot,
  );
}
