import type { DbClient } from '@/data/db-client';

/**
 * Schema-Migrationen, versioniert über `PRAGMA user_version`.
 * Migration i bringt die DB von user_version i auf i+1.
 * Bestehende Migrationen werden NIE verändert — nur neue angehängt.
 */
export const MIGRATIONS: readonly string[] = [
  // 0 → 1: Grundschema
  `
  CREATE TABLE entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
    tmdb_id INTEGER NOT NULL,
    scope TEXT NOT NULL CHECK (scope IN ('title', 'season', 'episode')),
    season_number INTEGER,
    episode_number INTEGER,
    rating REAL CHECK (
      rating IS NULL
      OR (rating BETWEEN 0.5 AND 5.0 AND CAST(rating * 10 AS INTEGER) % 5 = 0)
    ),
    review_text TEXT,
    has_spoilers INTEGER NOT NULL DEFAULT 0,
    watched_at TEXT,
    is_rewatch INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'watched' CHECK (status IN ('watched', 'dropped')),
    dropped_reason TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    -- Filme kennen nur die Ebene 'title'
    CHECK (media_type = 'tv' OR scope = 'title'),
    -- Staffel-/Episodennummern passend zur Ebene
    CHECK (
      (scope = 'title' AND season_number IS NULL AND episode_number IS NULL)
      OR (scope = 'season' AND season_number IS NOT NULL AND episode_number IS NULL)
      OR (scope = 'episode' AND season_number IS NOT NULL AND episode_number IS NOT NULL)
    ),
    CHECK (dropped_reason IS NULL OR status = 'dropped')
  );

  CREATE INDEX idx_entries_created ON entries (created_at DESC, id DESC);
  CREATE INDEX idx_entries_media ON entries (media_type, tmdb_id);
  CREATE INDEX idx_entries_watched ON entries (watched_at);

  CREATE TABLE watchlist (
    media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
    tmdb_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (media_type, tmdb_id)
  );

  CREATE TABLE media_cache (
    media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
    tmdb_id INTEGER NOT NULL,
    payload TEXT NOT NULL,
    title TEXT NOT NULL,
    poster_path TEXT,
    release_date TEXT,
    runtime_minutes INTEGER,
    genres TEXT NOT NULL DEFAULT '[]',
    fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (media_type, tmdb_id)
  );

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  `,
];

export const LATEST_VERSION = MIGRATIONS.length;

/** Führt alle ausstehenden Migrationen aus. Idempotent. */
export async function migrateDb(db: DbClient): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;', []);
  const currentVersion = row?.user_version ?? 0;

  for (let v = currentVersion; v < MIGRATIONS.length; v++) {
    await db.execAsync('BEGIN;');
    try {
      await db.execAsync(MIGRATIONS[v]);
      await db.execAsync(`PRAGMA user_version = ${v + 1};`);
      await db.execAsync('COMMIT;');
    } catch (error) {
      await db.execAsync('ROLLBACK;');
      throw error;
    }
  }
}
