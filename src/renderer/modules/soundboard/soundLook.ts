import type { CSSProperties } from "react";
import {
  DEFAULT_SOUND_COLOR,
  DEFAULT_SOUND_COLOR2,
} from "../../../shared/soundboard";

// O botao do som (docs/mocks/sons-poster.html, opcao "D + E"): parado, fundo do tema com o
// nome no degrade das duas cores; tocando, o botao vira a cor 1 e o nome usa a "tinta".

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

const channels = (hex: string) =>
  [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));

/** Mistura de duas cores; weight e quanto entra da primeira. */
const mix = (first: string, second: string, weight: number) => {
  const a = channels(first);
  const b = channels(second);
  return `#${a
    .map((value, index) =>
      Math.round(value * weight + b[index] * (1 - weight))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
};

/** A cor e escura o bastante para texto branco (contraste WCAG contra branco e contra preto). */
const isDark = (hex: string) => {
  const [r, g, b] = channels(hex).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05;
};

/**
 * Variaveis do botao: --c1, --c2, --ink (o nome sobre a cor 1) e --c1-text (o nome na cor 1 sobre
 * o fundo escuro, no trecho que ainda nao tocou).
 */
export const soundTileStyle = (color?: string, color2?: string): CSSProperties => {
  const c1 = color && HEX_COLOR.test(color) ? color : DEFAULT_SOUND_COLOR;
  const c2 = color2 && HEX_COLOR.test(color2) ? color2 : DEFAULT_SOUND_COLOR2;
  const dark = isDark(c1);
  return {
    "--c1": c1,
    "--c2": c2,
    // Escura puxada para a cor 2; branca quando a cor 1 e escura
    "--ink": dark ? "#ffffff" : mix(c2, "#000000", 0.38),
    // Cor 1 escura sumiria no fundo escuro: clareada
    "--c1-text": dark ? mix(c1, "#ffffff", 0.5) : c1,
  } as CSSProperties;
};
