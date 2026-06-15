import type { LogCategory } from "../../shared/logTypes";
import { appendLog } from "./logStore";

export const logError = (
  category: LogCategory,
  message: string,
  data?: unknown,
) => appendLog(category, message, data);
