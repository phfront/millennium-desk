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

