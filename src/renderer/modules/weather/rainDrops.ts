export interface RainDropVars {
  d: number;
  a: number;
  x: number;
  y: number;
  o: number;
  s: number;
}

const pseudoRandom = (index: number, salt: number) => {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

export const createRainDrops = (count: number): RainDropVars[] =>
  Array.from({ length: count }, (_, index) => ({
    d: pseudoRandom(index, 1) * 1.6,
    a: 0.55 + pseudoRandom(index, 2) * 0.7,
    x: pseudoRandom(index, 3) * 100,
    y: pseudoRandom(index, 4) * 140,
    o: 0.22 + pseudoRandom(index, 5) * 0.5,
    s: 0.65 + pseudoRandom(index, 6) * 0.55,
  }));

export interface SnowFlakeVars {
  /** Fase da queda (delay negativo em s). */
  d: number;
  /** Duracao da queda em s. */
  a: number;
  /** Posicao horizontal em %. */
  x: number;
  o: number;
  s: number;
  /** Amplitude do balanco lateral em px. */
  w: number;
  /** Duracao do balanco em s. */
  wd: number;
  /** Fase do balanco (0-1). */
  wp: number;
}

export const createSnowFlakes = (count: number): SnowFlakeVars[] =>
  Array.from({ length: count }, (_, index) => ({
    d: pseudoRandom(index, 7) * 12,
    a: 5 + pseudoRandom(index, 8) * 6,
    x: pseudoRandom(index, 9) * 100,
    o: 0.35 + pseudoRandom(index, 10) * 0.6,
    s: 0.5 + pseudoRandom(index, 11) * 0.75,
    w: 4 + pseudoRandom(index, 12) * 10,
    wd: 1.6 + pseudoRandom(index, 13) * 2.4,
    wp: pseudoRandom(index, 14),
  }));
