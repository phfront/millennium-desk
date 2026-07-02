import type { DatabaseSync } from "node:sqlite";

const MIGRATIONS: Array<{ version: number; sql: string }> = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_date TEXT NOT NULL CHECK (task_date GLOB '????-??-??'),
        text TEXT NOT NULL CHECK (length(trim(text)) > 0),
        done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_task_date ON tasks(task_date);
    `,
  },
  {
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        color TEXT NOT NULL CHECK (length(trim(color)) > 0),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

      CREATE TABLE IF NOT EXISTS task_tags (
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (task_id, tag_id)
      );
    `,
  },
  {
    version: 3,
    sql: `
      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        payload TEXT NOT NULL DEFAULT '{}'
      );

      INSERT OR IGNORE INTO app_settings (id, payload) VALUES (1, '{}');
    `,
  },
  {
    version: 4,
    sql: `
      CREATE TABLE IF NOT EXISTS shortcuts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        type TEXT NOT NULL CHECK (type IN ('app', 'file', 'url', 'batch', 'powershell')),
        target TEXT NOT NULL CHECK (length(trim(target)) > 0),
        args_json TEXT NOT NULL DEFAULT '[]',
        working_directory TEXT,
        color TEXT NOT NULL DEFAULT '#8c8dff',
        confirm_before_run INTEGER NOT NULL DEFAULT 0 CHECK (confirm_before_run IN (0, 1)),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_shortcuts_sort_order
        ON shortcuts(sort_order, id);
    `,
  },
  {
    version: 5,
    sql: `
      ALTER TABLE shortcuts ADD COLUMN icon_data_url TEXT;
    `,
  },
  {
    version: 6,
    sql: `
      ALTER TABLE shortcuts ADD COLUMN grid_slot INTEGER;
      UPDATE shortcuts SET grid_slot = sort_order WHERE grid_slot IS NULL;
    `,
  },
  {
    version: 7,
    sql: `
      ALTER TABLE shortcuts ADD COLUMN image_only INTEGER NOT NULL DEFAULT 0
        CHECK (image_only IN (0, 1));
    `,
  },
  {
    version: 8,
    sql: `
      ALTER TABLE shortcuts ADD COLUMN color_2 TEXT NOT NULL DEFAULT '#5a67ff';
    `,
  },
  {
    // Tarefas recorrentes: sem data fixa (task_date passa a ser a data de
    // inicio), aparecem todos os dias ate serem concluidas; completed_on
    // registra o dia da conclusao.
    version: 9,
    sql: `
      ALTER TABLE tasks ADD COLUMN persistent INTEGER NOT NULL DEFAULT 0
        CHECK (persistent IN (0, 1));
      ALTER TABLE tasks ADD COLUMN completed_on TEXT
        CHECK (completed_on IS NULL OR completed_on GLOB '????-??-??');
      CREATE INDEX IF NOT EXISTS idx_tasks_persistent
        ON tasks(persistent) WHERE persistent = 1;
    `,
  },
];

const getCurrentVersion = (database: DatabaseSync) => {
  const tableExists = database
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
    )
    .get() as { name: string } | undefined;

  if (!tableExists) return 0;

  const row = database
    .prepare("SELECT MAX(version) AS version FROM schema_migrations")
    .get() as { version: number | null } | undefined;

  return row?.version ?? 0;
};

export const runMigrations = (database: DatabaseSync) => {
  const currentVersion = getCurrentVersion(database);

  for (const migration of MIGRATIONS) {
    if (migration.version <= currentVersion) continue;

    database.exec("BEGIN");
    try {
      database.exec(migration.sql);
      database
        .prepare("INSERT INTO schema_migrations (version) VALUES (?)")
        .run(migration.version);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
};
