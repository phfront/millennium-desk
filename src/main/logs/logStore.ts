import type { LogCategory, LogEntry, LogQuery } from "../../shared/logTypes";

const MAX_ENTRIES = 500;

let nextId = 1;
const entries: LogEntry[] = [];
const subscribers = new Set<(entry: LogEntry) => void>();

const matchesQuery = (entry: LogEntry, query: LogQuery) => {
  if (query.categories?.length && !query.categories.includes(entry.category)) {
    return false;
  }

  if (query.afterId !== undefined && entry.id <= query.afterId) {
    return false;
  }

  const search = query.search?.trim().toLowerCase();
  if (search) {
    const haystack = [
      entry.message,
      entry.category,
      entry.data !== undefined ? JSON.stringify(entry.data) : "",
    ]
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(search)) return false;
  }

  return true;
};

export const appendLog = (
  category: LogCategory,
  message: string,
  data?: unknown,
): LogEntry => {
  const entry: LogEntry = {
    id: nextId++,
    timestamp: new Date().toISOString(),
    level: "error",
    category,
    message,
    ...(data !== undefined ? { data } : {}),
  };

  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }

  for (const subscriber of subscribers) {
    subscriber(entry);
  }

  return entry;
};

export const queryLogs = (query: LogQuery = {}): LogEntry[] => {
  const limit = query.limit ?? MAX_ENTRIES;
  const filtered = entries.filter((entry) => matchesQuery(entry, query));
  return filtered.slice(-limit).reverse();
};

export const clearLogs = () => {
  entries.length = 0;
};

export const subscribeLogs = (callback: (entry: LogEntry) => void) => {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
};
