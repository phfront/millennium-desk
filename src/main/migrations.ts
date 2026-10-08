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
  {
    // Migracao automatica: tarefa datada com rollover = 1 que passa do dia sem
    // ser concluida e trazida para o dia atual na proxima leitura.
    version: 10,
    sql: `
      ALTER TABLE tasks ADD COLUMN rollover INTEGER NOT NULL DEFAULT 0
        CHECK (rollover IN (0, 1));
      CREATE INDEX IF NOT EXISTS idx_tasks_rollover
        ON tasks(rollover) WHERE rollover = 1;
    `,
  },
  {
    // Sons do modulo de efeitos: o audio fica em userData/sounds, aqui so o nome do arquivo.
    // A 11 e de Passagens (branch wip/passagens), ja aplicada no banco do Pedro.
    version: 12,
    sql: `
      CREATE TABLE IF NOT EXISTS sounds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        emoji TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '#f08a4b',
        color_2 TEXT NOT NULL DEFAULT '#e15f9a',
        volume REAL NOT NULL DEFAULT 1 CHECK (volume >= 0 AND volume <= 1),
        file_name TEXT NOT NULL CHECK (length(trim(file_name)) > 0),
        grid_slot INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_sounds_grid_slot ON sounds(grid_slot, id);
    `,
  },
  {
    // Imagem no botao do som (data URL), como a dos Atalhos
    version: 13,
    sql: `
      ALTER TABLE sounds ADD COLUMN icon_data_url TEXT;
    `,
  },
  {
    // Sons com nome grande (mock docs/mocks/sons-poster.html): quem ainda esta na cor padrao
    // antiga ganha a paleta nova pela posicao na grade (SOUND_PALETTE); cor escolhida a mao fica.
    version: 14,
    sql: `
      UPDATE sounds
      SET
        color = CASE grid_slot % 14
          WHEN 0 THEN '#ff8a5c' WHEN 1 THEN '#ffd166' WHEN 2 THEN '#8c8dff'
          WHEN 3 THEN '#4cc9a0' WHEN 4 THEN '#ff6fb5' WHEN 5 THEN '#5ec8f2'
          WHEN 6 THEN '#b4e05a' WHEN 7 THEN '#c084fc' WHEN 8 THEN '#f87171'
          WHEN 9 THEN '#fbbf24' WHEN 10 THEN '#38bdf8' WHEN 11 THEN '#f9a8d4'
          WHEN 12 THEN '#86efac' ELSE '#4a7fc8' END,
        color_2 = CASE grid_slot % 14
          WHEN 0 THEN '#e2416b' WHEN 1 THEN '#f28c28' WHEN 2 THEN '#5a67ff'
          WHEN 3 THEN '#1f8f7a' WHEN 4 THEN '#a64dff' WHEN 5 THEN '#3a6fd8'
          WHEN 6 THEN '#4caf50' WHEN 7 THEN '#7c3aed' WHEN 8 THEN '#b91c1c'
          WHEN 9 THEN '#ef6c00' WHEN 10 THEN '#0e7490' WHEN 11 THEN '#ec4899'
          WHEN 12 THEN '#16a34a' ELSE '#6b4a6e' END,
        updated_at = datetime('now')
      WHERE lower(color) = '#f08a4b' AND lower(color_2) = '#e15f9a';
    `,
  },
  {
    // Catalogo dos Sons: desligado, o som sai da grade e fica so no catalogo (grid_slot guarda
    // o ultimo lugar, para voltar a ele)
    version: 15,
    sql: `
      ALTER TABLE sounds ADD COLUMN active INTEGER NOT NULL DEFAULT 1
        CHECK (active IN (0, 1));
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
