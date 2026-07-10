import { memo, useEffect, useState, type CSSProperties } from "react";
import type {
  TemperatureUnit,
  WeatherForecast,
  WeatherLocation,
} from "../../../shared/contracts";
import { WeatherIcon } from "./WeatherIcon";
import { getWeatherPlacePalette, getWeatherVisual } from "./weatherCodes";

const round = (value: number) => Math.round(value);

const formatLocation = (location: WeatherLocation) =>
  [location.region, location.country].filter(Boolean).join(", ");

/**
 * Linha de um local: hora local ao vivo, dia e temperatura, com o fundo
 * refletindo o horario (dia/noite) e o tempo do proprio local.
 */
const WeatherPlaceRow = memo(function WeatherPlaceRow({
  location,
  temperatureUnit,
}: {
  location: WeatherLocation;
  temperatureUnit: TemperatureUnit;
}) {
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let alive = true;
    const load = () => {
      window.electronControl.weather
        .getForecast(location, temperatureUnit)
        .then((value) => {
          if (alive) setForecast(value);
        })
        .catch(() => {
          // Sem clima a linha ainda mostra hora e dia do local.
        });
    };
    load();
    const timer = window.setInterval(load, 30 * 60 * 1000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [location, temperatureUnit]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  const timeZone = location.timezone;
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(now);
  const weekday = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    timeZone,
  })
    .format(now)
    .replace(".", "");

  const visual = forecast
    ? getWeatherVisual(forecast.current.weatherCode)
    : null;
  const palette = visual
    ? getWeatherPlacePalette(visual.tone, forecast?.current.isDay !== false)
    : null;
  const style = palette
    ? ({
        "--wp-start": palette.start,
        "--wp-end": palette.end,
        "--wp-fg": palette.fg,
        "--wp-muted": palette.mutedFg,
      } as CSSProperties)
    : undefined;

  return (
    <div
      className="weather-place"
      style={style}
      title={
        visual
          ? `${location.name} — ${visual.label}`
          : location.name
      }
    >
      <div className="weather-place-name">
        <strong>{location.name}</strong>
        <span>{formatLocation(location)}</span>
      </div>
      <div className="weather-place-time">
        <strong>{time}</strong>
        <span>{weekday}</span>
      </div>
      <div className="weather-place-temp">
        {forecast ? (
          <>
            <WeatherIcon
              code={forecast.current.weatherCode}
              isDay={forecast.current.isDay}
              size={30}
            />
            <strong>
              {round(forecast.current.temperature)}
              {forecast.temperatureUnit}
            </strong>
          </>
        ) : (
          <strong>—</strong>
        )}
      </div>
    </div>
  );
});

export const WeatherModule = memo(function WeatherModule({
  location,
  savedLocations,
  temperatureUnit,
}: {
  location: WeatherLocation;
  savedLocations: WeatherLocation[];
  temperatureUnit: TemperatureUnit;
  onLocationChange: (location: WeatherLocation) => void;
  onConfigure: () => void;
}) {
  const locations = savedLocations.length > 0 ? savedLocations : [location];

  return (
    <div className="module-content weather-module">
      <div className="module-heading weather-module-heading">
        <div>
          <span className="eyebrow">CLIMA · HORARIO</span>
          <h2>Ambiente</h2>
        </div>
      </div>

      <div className="module-body weather-list-body">
        {locations.map((savedLocation) => (
          <WeatherPlaceRow
            key={savedLocation.id}
            location={savedLocation}
            temperatureUnit={temperatureUnit}
          />
        ))}
      </div>
    </div>
  );
});
