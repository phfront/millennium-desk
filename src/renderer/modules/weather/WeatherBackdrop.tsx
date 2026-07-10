import { useMemo, type CSSProperties } from "react";
import { createRainDrops, createSnowFlakes } from "./rainDrops";

const STAR_COORDS = [
  "12% 18%", "28% 42%", "44% 12%", "61% 28%", "78% 8%",
  "8% 62%", "22% 78%", "37% 55%", "53% 72%", "69% 48%",
  "84% 64%", "91% 22%", "16% 34%", "72% 86%", "48% 38%",
] as const;

const RAIN_DROP_PATH =
  "M2 0 C2.6 7 3 16 2.4 26 C2.15 28.5 1.85 28.5 1.6 26 C1 16 1.4 7 2 0 Z";

export function WeatherBackdrop({
  tone,
  isDay,
  compact = false,
}: {
  tone: "clear" | "cloud" | "rain" | "storm" | "snow" | "fog";
  isDay: boolean;
  /** Cena reduzida para linhas pequenas: menos gotas e estrelas. */
  compact?: boolean;
}) {
  const showRain = tone === "rain" || tone === "storm";
  const showSnow = tone === "snow";
  const showFog = tone === "fog" || tone === "cloud";
  const showStormFlash = tone === "storm";
  // Chovendo nao ha sol nem lua: so nuvens pesadas, como no app da Apple.
  const showOrb = !showRain;
  const rainDrops = useMemo(
    () =>
      createRainDrops(
        compact ? (tone === "storm" ? 260 : 140) : tone === "storm" ? 600 : 300,
      ),
    [compact, tone],
  );
  const snowFlakes = useMemo(
    () => (showSnow ? createSnowFlakes(compact ? 144 : 270) : []),
    [compact, showSnow],
  );
  const starCoords = compact ? STAR_COORDS.slice(0, 8) : STAR_COORDS;

  return (
    <div className="weather-scene" aria-hidden="true">
      <div className="weather-scene-sky" />
      {showOrb && (
        <div
          className={
            isDay ? "weather-scene-orb weather-scene-sun" : "weather-scene-orb weather-scene-moon"
          }
        />
      )}
      {showOrb && <div className="weather-scene-glow" />}
      <div className="weather-scene-clouds">
        <span className="weather-scene-cloud cloud-a" />
        <span className="weather-scene-cloud cloud-b" />
        <span className="weather-scene-cloud cloud-c" />
      </div>
      {!isDay && (
        <div className="weather-scene-stars">
          {starCoords.map((position) => (
            <span
              key={position}
              style={{ left: position.split(" ")[0], top: position.split(" ")[1] }}
            />
          ))}
        </div>
      )}
      {showFog && (
        <div className="weather-scene-mist">
          <span className="mist-a" />
          <span className="mist-b" />
        </div>
      )}
      {showRain && (
        <div className={tone === "storm" ? "weather-scene-rain is-storm" : "weather-scene-rain"}>
          {rainDrops.map((drop, index) => (
            <span
              key={index}
              className="weather-rain-drop"
              style={
                {
                  "--d": drop.d,
                  "--a": drop.a,
                  "--x": drop.x,
                  "--y": drop.y,
                  "--o": drop.o,
                  "--s": drop.s,
                } as CSSProperties
              }
            >
              <svg viewBox="0 0 4 30" aria-hidden="true">
                <path d={RAIN_DROP_PATH} />
              </svg>
            </span>
          ))}
        </div>
      )}
      {showSnow && (
        <div className="weather-scene-snow">
          {snowFlakes.map((flake, index) => (
            <span
              key={index}
              className="weather-snow-flake"
              style={
                {
                  "--d": flake.d,
                  "--a": flake.a,
                  "--x": flake.x,
                  "--o": flake.o,
                  "--s": flake.s,
                  "--w": flake.w,
                  "--wd": flake.wd,
                  "--wp": flake.wp,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
      {showStormFlash && (
        <>
          <div className="weather-scene-flash" />
          <svg className="weather-scene-bolt bolt-a" viewBox="0 0 60 120" aria-hidden="true">
            <path d="M32 0 L22 40 L34 36 L20 78 L30 74 L16 118" />
            <path d="M27 52 L12 70" />
          </svg>
          <svg className="weather-scene-bolt bolt-b" viewBox="0 0 60 120" aria-hidden="true">
            <path d="M32 0 L22 40 L34 36 L20 78 L30 74 L16 118" />
            <path d="M27 52 L12 70" />
          </svg>
        </>
      )}
    </div>
  );
}
