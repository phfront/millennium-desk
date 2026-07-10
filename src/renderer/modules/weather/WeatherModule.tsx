import { memo, useCallback, useEffect, useRef, useState } from "react";
import type {
  TemperatureUnit,
  WeatherForecast,
  WeatherLocation,
} from "../../../shared/contracts";
import { WeatherBackdrop } from "./WeatherBackdrop";
import { WeatherIcon } from "./WeatherIcon";
import { getWeatherVisual } from "./weatherCodes";

const formatHour = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { hour: "2-digit" }).format(new Date(value));

const formatDay = (value: string, index: number) =>
  index === 0
    ? "Hoje"
    : new Intl.DateTimeFormat("pt-BR", { weekday: "short" })
        .format(new Date(`${value}T12:00:00`))
        .replace(".", "");

const round = (value: number) => Math.round(value);

const formatLocalTime = (timestamp: string, timeZone: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone,
  }).format(new Date(timestamp));

const formatTodayDate = (timestamp: string, timeZone: string) => {
  const date = new Date(timestamp);
  return {
    weekday: new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      timeZone,
    }).format(date),
    date: new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
    })
      .format(date)
      .replace(/^[^,]+,\s*/u, ""),
  };
};

const formatLocation = (location: WeatherLocation) =>
  [location.region, location.country].filter(Boolean).join(", ");

// Relogio isolado: o tick de 1s re-renderiza somente este bloco, e nao o
// modulo inteiro (cena animada + listas de previsao).
const WeatherLocalClock = memo(function WeatherLocalClock({
  timeZone,
}: {
  timeZone: string;
}) {
  const [localTime, setLocalTime] = useState("");
  const [localDate, setLocalDate] = useState({ weekday: "", date: "" });

  useEffect(() => {
    const updateClock = () => {
      const now = new Date().toISOString();
      setLocalTime(formatLocalTime(now, timeZone));
      setLocalDate(formatTodayDate(now, timeZone));
    };
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, [timeZone]);

  return (
    <div className="weather-location-time">
      <span className="weather-today-date">
        <span>{localDate.weekday}</span>
        <span>{localDate.date}</span>
      </span>
      <strong>{localTime}</strong>
    </div>
  );
});

// Linha compacta de outro local salvo: hora local, dia e temperatura.
const WeatherPlaceRow = memo(function WeatherPlaceRow({
  location,
  temperatureUnit,
  onSelect,
}: {
  location: WeatherLocation;
  temperatureUnit: TemperatureUnit;
  onSelect: () => void;
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

  return (
    <button
      type="button"
      className="weather-place"
      title={`Mostrar ${location.name}`}
      onClick={onSelect}
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
              size={26}
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
    </button>
  );
});

export const WeatherModule = memo(function WeatherModule({
  location,
  savedLocations,
  temperatureUnit,
  onLocationChange,
  onConfigure,
}: {
  location: WeatherLocation;
  savedLocations: WeatherLocation[];
  temperatureUnit: TemperatureUnit;
  onLocationChange: (location: WeatherLocation) => void;
  onConfigure: () => void;
}) {
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const loadForecast = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setForecast(
        await window.electronControl.weather.getForecast(
          location,
          temperatureUnit,
        ),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível atualizar o clima.",
      );
    } finally {
      setLoading(false);
    }
  }, [location, temperatureUnit]);

  useEffect(() => {
    void loadForecast();
    const timer = window.setInterval(() => void loadForecast(), 30 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [loadForecast]);

  useEffect(() => {
    if (!pickerOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [pickerOpen]);

  const visual = getWeatherVisual(forecast?.current.weatherCode ?? 0);
  const isDay = forecast?.current.isDay !== false;
  const pickerLocations =
    savedLocations.length > 0 ? savedLocations : [location];
  const sceneClassName = `module-body weather-body weather-tone-${visual.tone} ${
    isDay ? "weather-day" : "weather-night"
  }`;

  return (
    <div className="module-content weather-module">
      <div className="module-heading weather-module-heading">
        <div>
          <span className="eyebrow">CLIMA · HORARIO</span>
          <h2>Ambiente</h2>
        </div>
        <div className="module-actions">
          <button
            className="module-action-icon weather-refresh-button"
            aria-label="Atualizar clima"
            title="Atualizar"
            onClick={() => void loadForecast()}
          />
          <button
            className="module-action-icon module-config-button"
            aria-label="Configurar clima"
            title="Configurar"
            onClick={onConfigure}
          />
        </div>
      </div>

      <div className={sceneClassName}>
        <WeatherBackdrop tone={visual.tone} isDay={isDay} />
        <div className="weather-stage">
          {loading && !forecast && (
            <div className="weather-loading">
              <span />
              <strong>Consultando o céu...</strong>
            </div>
          )}

          {error && !forecast && (
            <div className="weather-error">
              <strong>Clima indisponível</strong>
              <span>{error}</span>
              <button onClick={() => void loadForecast()}>Tentar novamente</button>
            </div>
          )}

          {forecast && (
            <>
              <section
                className={
                  pickerOpen ? "weather-hero is-open" : "weather-hero"
                }
              >
                <header className="weather-topbar">
                  <div
                    className={
                      pickerOpen ? "weather-location is-open" : "weather-location"
                    }
                    ref={pickerRef}
                  >
                    <button
                      type="button"
                      className={
                        pickerOpen
                          ? "weather-location-picker open"
                          : "weather-location-picker"
                      }
                      aria-expanded={pickerOpen}
                      aria-haspopup="listbox"
                      aria-label={`Trocar local. Atual: ${forecast.location.name}`}
                      title="Trocar local"
                      onClick={() => setPickerOpen((value) => !value)}
                    >
                      <span className="weather-location-pin" />
                      <div>
                        <strong>{forecast.location.name}</strong>
                        <span>{formatLocation(forecast.location)}</span>
                      </div>
                    </button>
                    {pickerOpen && (
                      <div className="weather-location-menu" role="listbox">
                        {pickerLocations.map((savedLocation) => {
                          const active = savedLocation.id === location.id;
                          return (
                            <button
                              key={savedLocation.id}
                              type="button"
                              role="option"
                              aria-selected={active}
                              className={active ? "active" : ""}
                              onClick={() => {
                                onLocationChange(savedLocation);
                                setPickerOpen(false);
                              }}
                            >
                              <strong>{savedLocation.name}</strong>
                              <span>{formatLocation(savedLocation)}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <WeatherLocalClock
                    timeZone={
                      forecast.location.timezone ?? location.timezone
                    }
                  />
                </header>

                <div className="weather-current">
                  <div className="weather-current-icon">
                    <WeatherIcon
                      code={forecast.current.weatherCode}
                      isDay={forecast.current.isDay}
                      size={94}
                    />
                  </div>
                  <div className="weather-temperature">
                    <strong>
                      {round(forecast.current.temperature)}
                      <sup>{forecast.temperatureUnit}</sup>
                    </strong>
                    <span>{visual.label}</span>
                    <small>
                      Sensação de {round(forecast.current.apparentTemperature)}
                      {forecast.temperatureUnit}
                    </small>
                  </div>
                </div>
              </section>

              {pickerLocations.filter(
                (savedLocation) => savedLocation.id !== forecast.location.id,
              ).length > 0 && (
                <section className="weather-places">
                  {pickerLocations
                    .filter(
                      (savedLocation) =>
                        savedLocation.id !== forecast.location.id,
                    )
                    .map((savedLocation) => (
                      <WeatherPlaceRow
                        key={savedLocation.id}
                        location={savedLocation}
                        temperatureUnit={temperatureUnit}
                        onSelect={() => onLocationChange(savedLocation)}
                      />
                    ))}
                </section>
              )}

              <div className="weather-metrics">
                <div>
                  <span>Umidade</span>
                  <strong>{forecast.current.humidity}%</strong>
                </div>
                <div>
                  <span>Chuva</span>
                  <strong>{forecast.current.precipitationProbability}%</strong>
                </div>
                <div>
                  <span>Vento</span>
                  <strong>
                    {round(forecast.current.windSpeed)}
                    <small>{forecast.windSpeedUnit}</small>
                  </strong>
                </div>
              </div>

              <section className="weather-section">
                <div className="weather-section-heading">
                  <strong>Próximas horas</strong>
                  <span>Atualizado agora</span>
                </div>
                <div className="weather-hourly">
                  {forecast.hourly.slice(0, 8).map((hour, index) => (
                    <div className={index === 0 ? "current" : ""} key={hour.time}>
                      <span>{index === 0 ? "Agora" : formatHour(hour.time)}</span>
                      <WeatherIcon code={hour.weatherCode} size={34} />
                      <strong>
                        {round(hour.temperature)}
                        {forecast.temperatureUnit}
                      </strong>
                      <small>{hour.precipitationProbability}%</small>
                    </div>
                  ))}
                </div>
              </section>

              <section className="weather-section weather-days-section">
                <div className="weather-section-heading">
                  <strong>Próximos dias</strong>
                  {error && <span className="weather-stale">Dados anteriores</span>}
                </div>
                <div className="weather-days">
                  {forecast.daily.slice(0, 5).map((day, index) => (
                    <div key={day.date}>
                      <span>{formatDay(day.date, index)}</span>
                      <WeatherIcon code={day.weatherCode} size={34} />
                      <small>{day.precipitationProbability}%</small>
                      <strong>
                        {round(day.temperatureMax)}°
                        <em>{round(day.temperatureMin)}°</em>
                      </strong>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
