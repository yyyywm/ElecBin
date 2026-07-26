import { getDatabase } from './connection';

export function initDatabase(): void {
  const db = getDatabase();

  db.exec(`
    CREATE TABLE IF NOT EXISTS components (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      part_number     TEXT    NOT NULL UNIQUE,
      description     TEXT    NOT NULL DEFAULT '',
      category        TEXT    NOT NULL DEFAULT 'Uncategorized',
      package         TEXT    NOT NULL DEFAULT '',
      value           TEXT    NOT NULL DEFAULT '',
      quantity        INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
      location        TEXT    NOT NULL DEFAULT '',
      min_stock       INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
      notes           TEXT    NOT NULL DEFAULT '',
      created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_components_part_number ON components(part_number);
    CREATE INDEX IF NOT EXISTS idx_components_category ON components(category);

    CREATE TABLE IF NOT EXISTS bom_imports (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      filename        TEXT    NOT NULL,
      original_name   TEXT    NOT NULL,
      total_items     INTEGER NOT NULL DEFAULT 0,
      status          TEXT    NOT NULL DEFAULT 'imported'
                          CHECK (status IN ('imported', 'compared', 'consumed')),
      notes           TEXT    NOT NULL DEFAULT '',
      consumed_at     TEXT    DEFAULT NULL,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS bom_items (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      bom_import_id       INTEGER NOT NULL,
      part_number         TEXT    NOT NULL,
      description         TEXT    NOT NULL DEFAULT '',
      qty                 INTEGER NOT NULL DEFAULT 1 CHECK (qty > 0),
      reference_designators TEXT  NOT NULL DEFAULT '',
      comparison_status   TEXT    DEFAULT NULL
                          CHECK (comparison_status IN (NULL, 'found', 'insufficient', 'missing')),
      matched_component_id INTEGER DEFAULT NULL,
      available_stock     INTEGER DEFAULT NULL,
      created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (bom_import_id) REFERENCES bom_imports(id) ON DELETE CASCADE,
      FOREIGN KEY (matched_component_id) REFERENCES components(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bom_items_bom_import_id ON bom_items(bom_import_id);
    CREATE INDEX IF NOT EXISTS idx_bom_items_part_number ON bom_items(part_number);
    CREATE INDEX IF NOT EXISTS idx_bom_items_status ON bom_items(comparison_status);
  `);

  // Seed some default categories
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      name TEXT PRIMARY KEY
    );
  `);

  // Migrations for existing databases
  const migrations = [
    `ALTER TABLE bom_items ADD COLUMN value TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE bom_items ADD COLUMN package TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE bom_items ADD COLUMN notes TEXT NOT NULL DEFAULT ''`,
  ];

  for (const sql of migrations) {
    try {
      db.exec(sql);
    } catch {
      // Column already exists, ignore
    }
  }

  console.log('Database initialized successfully');
}