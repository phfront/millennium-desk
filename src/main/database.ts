import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { runMigrations } from "./migrations";

let database: DatabaseSync | null = null;
let databasePath: string | null = null;

export const getDatabasePath = () => {
  if (!databasePath) {
    throw new Error("Banco de dados ainda nao foi inicializado.");
  }
  return databasePath;
};

export const getDatabase = () => {
  if (!database) {
    throw new Error("Banco de dados ainda nao foi inicializado.");
  }
  return database;
};

export const initDatabase = (userDataPath: string) => {
  if (database) return database;

  databasePath = path.join(userDataPath, "dashboard.sqlite");
  database = new DatabaseSync(databasePath);
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  runMigrations(database);
  return database;
};

export const closeDatabase = () => {
  database?.close();
  database = null;
  databasePath = null;
};
