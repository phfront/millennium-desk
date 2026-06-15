import { useEffect, useState } from "react";
import type {
  TemperatureUnit,
  WeatherLocation,
} from "../../../shared/contracts";

const formatLocation = (location: WeatherLocation) =>
  [location.region, location.country].filter(Boolean).join(", ");

const hasLocation = (list: WeatherLocation[], location: WeatherLocation) =>
  list.some((item) => item.id === location.id);

export function WeatherSettingsPanel({
  location,
  savedLocations,
  temperatureUnit,
  onChange,
}: {
  location: WeatherLocation;
  savedLocations: WeatherLocation[];
  temperatureUnit: TemperatureUnit;
  onChange: (value: {
    location?: WeatherLocation;
    temperatureUnit?: TemperatureUnit;
    savedLocations?: WeatherLocation[];
  }) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WeatherLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setError(null);
      try {
        setResults(await window.electronControl.weather.searchLocations(normalized));
      } catch {
        setError("Não foi possível buscar essa cidade.");
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  const addLocation = (nextLocation: WeatherLocation) => {
    const nextSavedLocations = hasLocation(savedLocations, nextLocation)
      ? savedLocations
      : [...savedLocations, nextLocation];
    onChange({
      location: nextLocation,
      savedLocations: nextSavedLocations,
      temperatureUnit,
    });
    setQuery("");
    setResults([]);
  };

  const removeLocation = (id: number) => {
    const nextSavedLocations = savedLocations.filter((item) => item.id !== id);
    if (nextSavedLocations.length === 0) return;
    onChange({
      location:
        location.id === id ? nextSavedLocations[0] : location,
      savedLocations: nextSavedLocations,
      temperatureUnit,
    });
  };

  return (
    <>
      <section className="setting-group">
        <h3>Locais salvos</h3>
        <p className="muted">
          Adicione cidades aqui e troque entre elas pelo ícone de local no
          módulo de clima.
        </p>
        {savedLocations.length > 0 ? (
          <div className="weather-saved-locations">
            {savedLocations.map((savedLocation) => {
              const active = savedLocation.id === location.id;
              return (
                <div
                  key={savedLocation.id}
                  className={active ? "weather-saved-location active" : "weather-saved-location"}
                >
                  <button
                    className="weather-saved-location-select"
                    onClick={() =>
                      onChange({
                        location: savedLocation,
                        savedLocations,
                        temperatureUnit,
                      })
                    }
                  >
                    <strong>{savedLocation.name}</strong>
                    <span>{formatLocation(savedLocation)}</span>
                  </button>
                  {savedLocations.length > 1 && (
                    <button
                      className="weather-saved-location-remove"
                      aria-label={`Remover ${savedLocation.name}`}
                      title="Remover"
                      onClick={() => removeLocation(savedLocation.id)}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">Nenhum local salvo ainda.</p>
        )}
        <label className="weather-location-search">
          <span>Adicionar cidade</span>
          <input
            value={query}
            placeholder="Ex.: Tóquio, Curitiba, Lisboa..."
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {searching && <p className="muted">Buscando cidades...</p>}
        {error && <p className="settings-inline-error">{error}</p>}
        {results.length > 0 && (
          <div className="weather-location-results">
            {results.map((result) => (
              <button key={result.id} onClick={() => addLocation(result)}>
                <strong>{result.name}</strong>
                <span>{formatLocation(result)}</span>
              </button>
            ))}
          </div>
        )}
      </section>
      <section className="setting-group">
        <h3>Unidade</h3>
        <div className="segmented">
          {(["celsius", "fahrenheit"] as const).map((unit) => (
            <button
              key={unit}
              className={temperatureUnit === unit ? "selected" : ""}
              onClick={() => onChange({ location, savedLocations, temperatureUnit: unit })}
            >
              {unit === "celsius" ? "Celsius" : "Fahrenheit"}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
