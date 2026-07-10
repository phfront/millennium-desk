import { memo, useEffect, useState } from "react";
import type {
  TemperatureUnit,
  WeatherForecast,
  WeatherLocation,
} from "../../../shared/contracts";
import { WeatherBackdrop } from "./WeatherBackdrop";
import { WeatherIcon } from "./WeatherIcon";
import { getWeatherVisual } from "./weatherCodes";

const round = (value: number) => Math.round(value);

/**
 * Linha de um local: hora local ao vivo, dia e temperatura, com a cena
 * animada refletindo o horario (dia/noite) e o tempo do proprio local.
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
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const timeZone = location.timezone;
  const time = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone,
  }).format(now);
  const capitalize = (value: string) =>
    value.charAt(0).toUpperCase() + value.slice(1);
  const weekday = capitalize(
    new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone })
      .format(now)
      .replace(".", ""),
  );
  const fullDate = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone,
  })
    .formatToParts(now)
    .map((part) => (part.type === "month" ? capitalize(part.value) : part.value))
    .join("");

  const visual = forecast
    ? getWeatherVisual(forecast.current.weatherCode)
    : null;
  const isDay = forecast?.current.isDay !== false;
  const rowClassName = [
    "weather-place",
    isDay ? "weather-day" : "weather-night",
    visual ? `weather-tone-${visual.tone}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={rowClassName}
      title={visual ? `${location.name} — ${visual.label}` : location.name}
    >
      {visual && (
        <WeatherBackdrop tone={visual.tone} isDay={isDay} compact />
      )}
      <div className="weather-place-main">
        <div className="weather-place-time">
          {forecast && (
            <WeatherIcon
              code={forecast.current.weatherCode}
              isDay={forecast.current.isDay}
              size={22}
            />
          )}
          <strong>{time}</strong>
        </div>
        <span className="weather-place-date">
          <span className="weather-place-weekday">{weekday} · </span>
          {fullDate}
        </span>
      </div>
      <div className="weather-place-temp">
        {forecast ? (
          <strong>
            {round(forecast.current.temperature)}
            {forecast.temperatureUnit}
          </strong>
        ) : (
          <strong>—</strong>
        )}
        <span className="weather-place-name">{location.name}</span>
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
