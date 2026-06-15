import { ipcMain } from "electron";
import type {
  TemperatureUnit,
  WeatherLocation,
} from "../../shared/contracts";
import {
  getWeatherForecast,
  searchWeatherLocations,
} from "../services/weatherService";

export const registerWeatherIpc = () => {
  ipcMain.handle("weather:search-locations", (_event, query: string) =>
    searchWeatherLocations(query),
  );
  ipcMain.handle(
    "weather:get-forecast",
    (
      _event,
      location: WeatherLocation,
      temperatureUnit: TemperatureUnit,
    ) => getWeatherForecast(location, temperatureUnit),
  );
};
