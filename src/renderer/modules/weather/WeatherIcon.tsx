import { getWeatherVisual } from "./weatherCodes";

export function WeatherIcon({
  code,
  isDay = true,
  size = 48,
}: {
  code: number;
  isDay?: boolean;
  size?: number;
}) {
  const { tone } = getWeatherVisual(code);
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };

  if (tone === "clear") {
    return (
      <svg className="weather-icon" width={size} height={size} viewBox="0 0 64 64" aria-hidden>
        {isDay ? (
          <g {...common}>
            <circle cx="32" cy="32" r="11" />
            <path d="M32 7v8M32 49v8M7 32h8M49 32h8M14 14l6 6M44 44l6 6M50 14l-6 6M20 44l-6 6" />
          </g>
        ) : (
          <path {...common} d="M46 43A22 22 0 0 1 24 17a22 22 0 1 0 22 26Z" />
        )}
      </svg>
    );
  }

  return (
    <svg className="weather-icon" width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <g {...common}>
        {tone !== "fog" && <path d="M18 42h29a10 10 0 0 0 0-20 15 15 0 0 0-28-3A12 12 0 0 0 18 42Z" />}
        {tone === "rain" && <path d="m23 49-3 7M34 49l-3 7M45 49l-3 7" />}
        {tone === "storm" && <path d="m34 45-6 10h7l-4 7" />}
        {tone === "snow" && <path d="M23 51h.1M34 55h.1M45 51h.1" />}
        {tone === "fog" && <path d="M12 25h40M8 34h44M14 43h36" />}
      </g>
    </svg>
  );
}
