import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LATEST_VERSION, migrateDb } from '@/data/migrations';
import { NodeDbAdapter } from './node-db-adapter';

describe('migrateDb', () => {
  let db: NodeDbAdapter;

  beforeEach(async () => {
    db = new NodeDbAdapter();
    await migrateDb(db);
  });

  afterEach(() => {
    db.close();
  });

  it('bringt eine frische DB auf die neueste Version', async () => {
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;', []);
    expect(row?.user_version).toBe(LATEST_VERSION);
  });

  it('ist idempotent — zweiter Lauf ändert nichts', async () => {
    await migrateDb(db);
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;', []);
    expect(row?.user_version).toBe(LATEST_VERSION);
  });

  it('legt alle Tabellen an', async () => {
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      []
    );
    const names = tables.map((t) => t.name);
    for (const expected of ['entries', 'watchlist', 'media_cache', 'settings']) {
      expect(names).toContain(expected);
    }
  });

  describe('entries-Constraints', () => {
    it('lehnt Ratings ab, die keine Halbschritte sind', async () => {
      await expect(
        db.runAsync(
          "INSERT INTO entries (media_type, tmdb_id, scope, rating) VALUES ('movie', 1, 'title', ?)",
          [3.7]
        )
      ).rejects.toThrow();
    });

    it.each([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5])('akzeptiert Rating %s', async (rating) => {
      await expect(
        db.runAsync(
          "INSERT INTO entries (media_type, tmdb_id, scope, rating) VALUES ('movie', 1, 'title', ?)",
          [rating]
        )
      ).resolves.toBeTruthy();
    });

    it('lehnt Filme mit Staffel-Scope ab', async () => {
      await expect(
        db.runAsync(
          "INSERT INTO entries (media_type, tmdb_id, scope, season_number) VALUES ('movie', 1, 'season', 1)",
          []
        )
      ).rejects.toThrow();
    });

    it('lehnt Episoden-Scope ohne Episodennummer ab', async () => {
      await expect(
        db.runAsync(
          "INSERT INTO entries (media_type, tmdb_id, scope, season_number) VALUES ('tv', 1, 'episode', 1)",
          []
        )
      ).rejects.toThrow();
    });

    it('lehnt dropped_reason ohne dropped-Status ab', async () => {
      await expect(
        db.runAsync(
          "INSERT INTO entries (media_type, tmdb_id, scope, status, dropped_reason) VALUES ('tv', 1, 'title', 'watched', 'langweilig')",
          []
        )
      ).rejects.toThrow();
    });

    it('akzeptiert eine abgebrochene Serie mit Grund', async () => {
      await expect(
        db.runAsync(
          "INSERT INTO entries (media_type, tmdb_id, scope, status, dropped_reason) VALUES ('tv', 1, 'title', 'dropped', 'langweilig')",
          []
        )
      ).resolves.toBeTruthy();
    });
  });
});
