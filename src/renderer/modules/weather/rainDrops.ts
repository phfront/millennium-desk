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
    d: pseudoRandom(index, 1) * 2.2,
    a: 1.1 + pseudoRandom(index, 2) * 1.4,
    x: pseudoRandom(index, 3) * 100,
    y: pseudoRandom(index, 4) * 140,
    o: 0.22 + pseudoRandom(index, 5) * 0.5,
    s: 0.65 + pseudoRandom(index, 6) * 0.55,
  }));
