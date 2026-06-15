export type LogLevel = "error";

export type LogCategory =
  | "app"
  | "display"
  | "window"
  | "media"
  | "system";

export interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: unknown;
}

export interface LogQuery {
  categories?: LogCategory[];
  search?: string;
  limit?: number;
  afterId?: number;
}

export const LOG_LEVELS: LogLevel[] = ["error"];

export const LOG_CATEGORIES: LogCategory[] = [
  "app",
  "display",
  "window",
  "media",
  "system",
];

export const LOG_LEVEL_LABELS: Record<LogLevel, string> = {
  error: "Erro",
};

export const LOG_CATEGORY_LABELS: Record<LogCategory, string> = {
  app: "App",
  display: "Monitores",
  window: "Janela",
  media: "Midia",
  system: "Sistema",
};
