import type {
  TemperatureUnit,
  WeatherForecast,
  WeatherLocation,
} from "../../shared/contracts";

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const forecastCache = new Map<
  string,
  { expiresAt: number; forecast: WeatherForecast }
>();

const fetchJson = async (url: URL) => {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    throw new Error(`Servico de clima indisponivel (${response.status}).`);
  }
  return response.json() as Promise<unknown>;
};

export const searchWeatherLocations = async (
  query: string,
): Promise<WeatherLocation[]> => {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) return [];

  const url = new URL(GEOCODING_URL);
  url.searchParams.set("name", normalizedQuery);
  url.searchParams.set("count", "8");
  url.searchParams.set("language", "pt");
  url.searchParams.set("format", "json");

  const payload = (await fetchJson(url)) as {
    results?: Array<Record<string, unknown>>;
  };

  return (payload.results ?? []).flatMap((result) => {
    if (
      typeof result.id !== "number" ||
      typeof result.name !== "string" ||
      typeof result.country !== "string" ||
      typeof result.latitude !== "number" ||
      typeof result.longitude !== "number" ||
      typeof result.timezone !== "string"
    ) {
      return [];
    }
    return [{
      id: result.id,
      name: result.name,
      region:
        typeof result.admin1 === "string"
          ? result.admin1
          : typeof result.admin2 === "string"
            ? result.admin2
            : "",
      country: result.country,
      latitude: result.latitude,
      longitude: result.longitude,
      timezone: result.timezone,
    }];
  });
};

export const getWeatherForecast = async (
  location: WeatherLocation,
  temperatureUnit: TemperatureUnit,
): Promise<WeatherForecast> => {
  const cacheKey = `${location.latitude}:${location.longitude}:${temperatureUnit}`;
  const cached = forecastCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.forecast;

  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", String(location.latitude));
  url.searchParams.set("longitude", String(location.longitude));
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "6");
  url.searchParams.set("forecast_hours", "24");
  url.searchParams.set("temperature_unit", temperatureUnit);
  url.searchParams.set(
    "wind_speed_unit",
    temperatureUnit === "fahrenheit" ? "mph" : "kmh",
  );
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "weather_code",
      "is_day",
      "wind_speed_10m",
    ].join(","),
  );
  url.searchParams.set(
    "hourly",
    [
      "temperature_2m",
      "precipitation_probability",
      "weather_code",
    ].join(","),
  );
  url.searchParams.set(
    "daily",
    [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "sunrise",
      "sunset",
    ].join(","),
  );

  const data = (await fetchJson(url)) as any;
  if (!data.current || !data.hourly || !data.daily) {
    throw new Error("Resposta meteorologica incompleta.");
  }

  const hourly = (data.hourly.time as string[]).map((time, index) => ({
    time,
    temperature: data.hourly.temperature_2m[index],
    precipitationProbability:
      data.hourly.precipitation_probability[index] ?? 0,
    weatherCode: data.hourly.weather_code[index],
  }));
  const currentHour = hourly.find(
    (entry) => entry.time >= data.current.time.slice(0, 13),
  );

  const forecast: WeatherForecast = {
    location,
    temperatureUnit: temperatureUnit === "fahrenheit" ? "°F" : "°C",
    windSpeedUnit: temperatureUnit === "fahrenheit" ? "mph" : "km/h",
    fetchedAt: new Date().toISOString(),
    current: {
      time: data.current.time,
      temperature: data.current.temperature_2m,
      apparentTemperature: data.current.apparent_temperature,
      humidity: data.current.relative_humidity_2m,
      precipitationProbability:
        currentHour?.precipitationProbability ?? 0,
      weatherCode: data.current.weather_code,
      isDay: data.current.is_day === 1,
      windSpeed: data.current.wind_speed_10m,
    },
    hourly,
    daily: (data.daily.time as string[]).map((date, index) => ({
      date,
      temperatureMax: data.daily.temperature_2m_max[index],
      temperatureMin: data.daily.temperature_2m_min[index],
      precipitationProbability:
        data.daily.precipitation_probability_max[index] ?? 0,
      weatherCode: data.daily.weather_code[index],
      sunrise: data.daily.sunrise[index],
      sunset: data.daily.sunset[index],
    })),
  };
  forecastCache.set(cacheKey, {
    expiresAt: Date.now() + 15 * 60 * 1000,
    forecast,
  });
  return forecast;
};
