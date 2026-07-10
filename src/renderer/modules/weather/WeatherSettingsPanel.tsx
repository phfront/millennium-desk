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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftLabel, setDraftLabel] = useState("");

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

  const startRenaming = (target: WeatherLocation) => {
    setEditingId(target.id);
    setDraftLabel(target.label ?? target.name);
  };

  const commitRename = () => {
    if (editingId === null) return;
    const trimmed = draftLabel.trim();
    const nextSavedLocations = savedLocations.map((item) => {
      if (item.id !== editingId) return item;
      const { label: _label, ...rest } = item;
      return trimmed && trimmed !== item.name
        ? { ...rest, label: trimmed }
        : rest;
    });
    onChange({
      location:
        nextSavedLocations.find((item) => item.id === location.id) ?? location,
      savedLocations: nextSavedLocations,
      temperatureUnit,
    });
    setEditingId(null);
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
                  {editingId === savedLocation.id ? (
                    <div className="weather-saved-location-rename">
                      <input
                        autoFocus
                        value={draftLabel}
                        placeholder={savedLocation.name}
                        onChange={(event) => setDraftLabel(event.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") commitRename();
                          if (event.key === "Escape") setEditingId(null);
                        }}
                      />
                      <span>{formatLocation(savedLocation)}</span>
                    </div>
                  ) : (
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
                      <strong>{savedLocation.label ?? savedLocation.name}</strong>
                      <span>
                        {savedLocation.label
                          ? `${savedLocation.name} · ${formatLocation(savedLocation)}`
                          : formatLocation(savedLocation)}
                      </span>
                    </button>
                  )}
                  <button
                    className="weather-saved-location-rename-toggle"
                    aria-label={`Renomear ${savedLocation.name}`}
                    title="Renomear exibição"
                    onClick={() => startRenaming(savedLocation)}
                  >
                    ✎
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
