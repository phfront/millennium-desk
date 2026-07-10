export interface WeatherVisual {
  label: string;
  tone: "clear" | "cloud" | "rain" | "storm" | "snow" | "fog";
}

export const getWeatherVisual = (code: number): WeatherVisual => {
  if (code === 0) return { label: "Céu limpo", tone: "clear" };
  if (code <= 3) return { label: "Parcialmente nublado", tone: "cloud" };
  if (code === 45 || code === 48) return { label: "Neblina", tone: "fog" };
  if (code >= 71 && code <= 77) return { label: "Neve", tone: "snow" };
  if (code >= 95) return { label: "Tempestade", tone: "storm" };
  if (code >= 51 && code <= 82) return { label: "Chuva", tone: "rain" };
  return { label: "Tempo variável", tone: "cloud" };
};

export interface WeatherPlacePalette {
  start: string;
  end: string;
  fg: string;
  mutedFg: string;
}

/** Mesma paleta dos fundos do cenario (styles.css), por tom e dia/noite. */
export const getWeatherPlacePalette = (
  tone: WeatherVisual["tone"],
  isDay: boolean,
): WeatherPlacePalette => {
  const DAY_FG = { fg: "#12243a", mutedFg: "rgba(18, 36, 58, 0.68)" };
  const NIGHT_FG = { fg: "#f8fbff", mutedFg: "rgba(240, 247, 255, 0.72)" };

  if (isDay) {
    switch (tone) {
      case "clear":
        return { start: "#5eb3f0", end: "#3a8fd4", ...DAY_FG };
      case "cloud":
        return { start: "#8eb4cc", end: "#6a95b5", ...DAY_FG };
      case "rain":
        return { start: "#6a8faa", end: "#4d7088", ...DAY_FG };
      case "storm":
        return { start: "#6a6a8a", end: "#4a4a68", ...NIGHT_FG };
      case "snow":
        return { start: "#a8c0d0", end: "#88a8b8", ...DAY_FG };
      case "fog":
        return { start: "#9aa8b0", end: "#7a8890", ...DAY_FG };
    }
  }
  switch (tone) {
    case "clear":
      return { start: "#1c2850", end: "#080c1b", ...NIGHT_FG };
    case "cloud":
      return { start: "#243d5a", end: "#152333", ...NIGHT_FG };
    case "rain":
      return { start: "#183652", end: "#0c1928", ...NIGHT_FG };
    case "storm":
      return { start: "#292647", end: "#11101f", ...NIGHT_FG };
    case "snow":
      return { start: "#607a8b", end: "#2d414f", ...NIGHT_FG };
    case "fog":
      return { start: "#53636c", end: "#26343c", ...NIGHT_FG };
  }
};
