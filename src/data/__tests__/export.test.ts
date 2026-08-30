import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { addToWatchlistWithMedia, saveRating, type RatingInput } from '@/data/diary';
import {
  buildCsvExport,
  buildJsonExport,
  countStoredData,
  deleteAllUserData,
  type ExportBundle,
} from '@/data/export';
import { migrateDb } from '@/data/migrations';
import { getSetting, setSetting } from '@/data/settings';
import { parseCsvLine } from '@/data/letterboxd';
import type { MediaDetails, Rating } from '@/types/media';

import { NodeDbAdapter } from './node-db-adapter';

function details(overrides: Partial<MediaDetails> = {}): MediaDetails {
  return {
    mediaType: 'movie',
    tmdbId: 603,
    title: 'Matrix',
    year: 1999,
    overview: null,
    posterPath: '/m.jpg',
    backdropPath: null,
    genres: ['Action'],
    tmdbScore: 8.2,
    cast: [],
    trailerKey: null,
    runtimeMinutes: 136,
    seasonCount: null,
    episodeCount: null,
    seasons: [],
    directors: ['Lana Wachowski'],
    ...overrides,
  };
}

function input(overrides: Partial<RatingInput> = {}): RatingInput {
  return {
    scope: 'title',
    seasonNumber: null,
    episodeNumber: null,
    rating: 4.5 as Rating,
    reviewText: null,
    hasSpoilers: false,
    watchedAt: '2026-08-30',
    isRewatch: false,
    status: 'watched',
    droppedReason: null,
    tags: [],
    ...overrides,
  };
}

describe('Export', () => {
  let db: NodeDbAdapter;

  beforeEach(async () => {
    db = new NodeDbAdapter();
    await migrateDb(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('JSON', () => {
    it('enthält alle Einträge mit Metadaten', async () => {
      await saveRating(db, details(), input({ tags: ['im Kino'] }));

      const bundle = JSON.parse(await buildJsonExport(db)) as ExportBundle;

      expect(bundle.format).toBe('reviewer-export');
      expect(bundle.entryCount).toBe(1);
      expect(bundle.entries[0].title).toBe('Matrix');
      expect(bundle.entries[0].entry.rating).toBe(4.5);
      expect(bundle.entries[0].entry.tags).toEqual(['im Kino']);
    });

    it('bleibt bei leerer Datenbank gültiges JSON', async () => {
      const bundle = JSON.parse(await buildJsonExport(db)) as ExportBundle;
      expect(bundle.entryCount).toBe(0);
      expect(bundle.entries).toEqual([]);
    });
  });

  describe('CSV', () => {
    it('schreibt Kopfzeile und eine Zeile je Eintrag', async () => {
      await saveRating(db, details(), input());
      await saveRating(db, details({ tmdbId: 1, title: 'Heat' }), input({ rating: 5 as Rating }));

      const lines = (await buildCsvExport(db)).split('\n');

      expect(lines[0]).toContain('Titel');
      expect(lines).toHaveLength(3);
    });

    it('maskiert Anführungszeichen und Kommas im Review', async () => {
      await saveRating(
        db,
        details(),
        input({ reviewText: 'Er sagt "Hallo", dann geht er.' })
      );

      const lines = (await buildCsvExport(db)).split('\n');
      const fields = parseCsvLine(lines[1]);

      // Zurückgelesen muss exakt der Originaltext herauskommen
      expect(fields).toContain('Er sagt "Hallo", dann geht er.');
    });

    it('zerreißt Titel mit Komma nicht', async () => {
      await saveRating(db, details({ title: 'Lock, Stock and Two Smoking Barrels' }), input());

      const lines = (await buildCsvExport(db)).split('\n');
      const fields = parseCsvLine(lines[1]);

      expect(fields[0]).toBe('Lock, Stock and Two Smoking Barrels');
    });

    it('schreibt Episoden-Einträge mit Staffel und Folge', async () => {
      await saveRating(
        db,
        details({ mediaType: 'tv', tmdbId: 1396, title: 'Breaking Bad' }),
        input({ scope: 'episode', seasonNumber: 5, episodeNumber: 14 })
      );

      const fields = parseCsvLine((await buildCsvExport(db)).split('\n')[1]);
      expect(fields).toContain('episode');
      expect(fields).toContain('5');
      expect(fields).toContain('14');
    });
  });

  describe('deleteAllUserData', () => {
    it('entfernt Einträge, Watchlist und Cache vollständig', async () => {
      await saveRating(db, details(), input());
      await addToWatchlistWithMedia(db, details({ tmdbId: 999, title: 'Später' }));

      expect(await countStoredData(db)).toEqual({ entries: 1, watchlist: 1 });

      await deleteAllUserData(db);

      expect(await countStoredData(db)).toEqual({ entries: 0, watchlist: 0 });
      const cache = await db.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM media_cache',
        []
      );
      expect(cache?.n).toBe(0);
    });

    it('lässt die Einstellungen stehen', async () => {
      await setSetting(db, 'region', 'AT');
      await saveRating(db, details(), input());

      await deleteAllUserData(db);

      expect(await getSetting(db, 'region')).toBe('AT');
    });

    it('ist auf leerer Datenbank harmlos', async () => {
      await expect(deleteAllUserData(db)).resolves.toBeUndefined();
    });
  });
});
