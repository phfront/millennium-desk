import { useLayoutEffect, useRef } from "react";
import type { SoundItem } from "../../../shared/contracts";
import { SOUND_PEAK_COUNT, useSoundPeaks } from "./soundPeaks";

const FIT_MIN = 10;
/** Teto do tamanho em relacao a altura da caixa: no botao do mock (~90 px de caixa) da os 40 px. */
const FIT_HEIGHT_RATIO = 0.44;

/**
 * O nome do som no maior tamanho que cabe na caixa sem quebrar palavra: nome curto fica
 * enorme, nome longo desce de linha inteiro. A caixa e posicionada pelo CSS (className).
 */
export function SoundName({
  name,
  max = 40,
  className = "sound-tile-name",
}: {
  name: string;
  max?: number;
  className?: string;
}) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text) return;
    const fit = () => {
      if (!box.clientHeight || !box.clientWidth) return;
      // O teto cresce com o botao (grade de poucas colunas tem botao enorme); max e o piso dele
      const ceiling = Math.max(max, Math.round(box.clientHeight * FIT_HEIGHT_RATIO));
      // Busca binaria: nenhuma palavra passa da largura e o texto cabe na altura
      let low = FIT_MIN;
      let high = ceiling;
      let best = FIT_MIN;
      while (high - low > 0.5) {
        const size = (low + high) / 2;
        box.style.fontSize = `${size}px`;
        const fits =
          text.scrollWidth <= text.clientWidth + 1 &&
          text.offsetHeight <= box.clientHeight + 1;
        if (fits) {
          best = size;
          low = size;
        } else {
          high = size;
        }
      }
      box.style.fontSize = `${Math.floor(best)}px`;
    };
    fit();
    // A caixa so muda de tamanho com a grade (o font-size nao mexe nela, que e absoluta)
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    // A Anton chega depois do primeiro desenho: medir de novo com ela
    void document.fonts?.load(`${max}px Anton`).then(fit, () => {});
    return () => observer.disconnect();
  }, [name, max]);

  return (
    <span ref={boxRef} className={className} aria-hidden="true">
      <span ref={textRef} className="sound-tile-name-text">
        {name}
      </span>
    </span>
  );
}

const FLAT_PEAKS = Array.from({ length: SOUND_PEAK_COUNT }, () => 0.15);

/** A onda do audio no pe do botao: barras apagadas, as acesas por cima e o cursor. */
export function SoundWave({ sound }: { sound: SoundItem }) {
  const peaks = useSoundPeaks(sound) ?? FLAT_PEAKS;
  const bars = peaks.map((peak, index) => (
    <span key={index} style={{ height: `${Math.round(14 + 86 * peak)}%` }} />
  ));
  return (
    <span className="sound-wave" aria-hidden="true">
      <span className="sound-wave-bars">{bars}</span>
      <span className="sound-wave-bars sound-wave-bars--lit">{bars}</span>
      <span className="sound-wave-head" />
    </span>
  );
}
