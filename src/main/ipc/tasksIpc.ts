import { ipcMain } from "electron";
import type {
  CreateTagInput,
  CreateTaskInput,
  TaskExportPayload,
  UpdateTagInput,
  UpdateTaskInput,
} from "../../shared/contracts";
import { getDatabasePath } from "../database";
import {
  createTag,
  deleteTag,
  listTags,
  updateTag,
} from "../repositories/tagRepository";
import {
  createTask,
  deleteTask,
  exportTasksJson,
  listTasksByDate,
  updateTask,
} from "../repositories/taskRepository";

export const registerTasksIpc = () => {
  ipcMain.handle("tasks:list-by-date", (_event, taskDate: string) =>
    listTasksByDate(taskDate),
  );

  ipcMain.handle("tasks:create", (_event, input: CreateTaskInput) =>
    createTask(input),
  );

  ipcMain.handle("tasks:update", (_event, input: UpdateTaskInput) =>
    updateTask(input),
  );

  ipcMain.handle("tasks:delete", (_event, id: number) => {
    deleteTask(id);
  });

  ipcMain.handle("tasks:export-json", () => exportTasksJson());

  ipcMain.handle("tasks:get-database-path", () => ({
    path: getDatabasePath(),
  }));

  ipcMain.handle("tags:list", () => listTags());

  ipcMain.handle("tags:create", (_event, input: CreateTagInput) =>
    createTag(input),
  );

  ipcMain.handle("tags:update", (_event, input: UpdateTagInput) =>
    updateTag(input),
  );

  ipcMain.handle("tags:delete", (_event, id: number) => {
    deleteTag(id);
  });
};

export type TasksIpcPayload = TaskExportPayload;
