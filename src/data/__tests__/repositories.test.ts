import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  countEntries,
  deleteEntry,
  getEntryById,
  insertEntry,
  listEntriesForMedia,
  listRecentEntries,
  updateEntry,
} from '@/data/entries';
import { getCachedMedia, isFresh, upsertCachedMedia } from '@/data/media-cache';
import { migrateDb } from '@/data/migrations';
import { getSetting, setSetting } from '@/data/settings';
import {
  addToWatchlist,
  isOnWatchlist,
  listWatchlist,
  removeFromWatchlist,
} from '@/data/watchlist';
import type { NewEntry } from '@/types/media';
import { NodeDbAdapter } from './node-db-adapter';

function movieEntry(overrides: Partial<NewEntry> = {}): NewEntry {
  return {
    mediaType: 'movie',
    tmdbId: 603,
    scope: 'title',
    seasonNumber: null,
    episodeNumber: null,
    rating: 4.5,
    reviewText: 'Stark.',
    hasSpoilers: false,
    watchedAt: '2026-08-30',
    isRewatch: false,
    status: 'watched',
    droppedReason: null,
    tags: ['im Kino'],
    ...overrides,
  };
}

describe('Repositories', () => {
  let db: NodeDbAdapter;

  beforeEach(async () => {
    db = new NodeDbAdapter();
    await migrateDb(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('entries', () => {
    it('rundreise: insert → get liefert identische Daten', async () => {
      const created = await insertEntry(db, movieEntry());
      const loaded = await getEntryById(db, created.id);

      expect(loaded).not.toBeNull();
      expect(loaded?.mediaType).toBe('movie');
      expect(loaded?.rating).toBe(4.5);
      expect(loaded?.hasSpoilers).toBe(false);
      expect(loaded?.tags).toEqual(['im Kino']);
      expect(loaded?.watchedAt).toBe('2026-08-30');
    });

    it('speichert Episoden-Bewertungen einer Serie', async () => {
      const created = await insertEntry(
        db,
        movieEntry({ mediaType: 'tv', tmdbId: 1396, scope: 'episode', seasonNumber: 5, episodeNumber: 14, rating: 5 })
      );
      expect(created.seasonNumber).toBe(5);
      expect(created.episodeNumber).toBe(14);
    });

    it('update ändert nur die übergebenen Felder', async () => {
      const created = await insertEntry(db, movieEntry());
      await updateEntry(db, created.id, { rating: 3, tags: ['rewatch-wert'] });
      const loaded = await getEntryById(db, created.id);

      expect(loaded?.rating).toBe(3);
      expect(loaded?.tags).toEqual(['rewatch-wert']);
      expect(loaded?.reviewText).toBe('Stark.');
    });

    it('delete entfernt den Eintrag', async () => {
      const created = await insertEntry(db, movieEntry());
      await deleteEntry(db, created.id);
      expect(await getEntryById(db, created.id)).toBeNull();
      expect(await countEntries(db)).toBe(0);
    });

    it('listRecentEntries paginiert per Keyset ohne Duplikate', async () => {
      for (let i = 0; i < 5; i++) {
        await insertEntry(db, movieEntry({ tmdbId: 100 + i }));
      }
      const page1 = await listRecentEntries(db, { limit: 2 });
      expect(page1).toHaveLength(2);

      const last = page1[page1.length - 1];
      const page2 = await listRecentEntries(db, {
        limit: 10,
        before: { createdAt: last.createdAt, id: last.id },
      });
      expect(page2).toHaveLength(3);

      const ids = [...page1, ...page2].map((entry) => entry.id);
      expect(new Set(ids).size).toBe(5);
    });

    it('listEntriesForMedia liefert alle Ebenen eines Titels', async () => {
      await insertEntry(db, movieEntry({ mediaType: 'tv', tmdbId: 1396, rating: 5 }));
      await insertEntry(
        db,
        movieEntry({ mediaType: 'tv', tmdbId: 1396, scope: 'season', seasonNumber: 4, rating: 4.5 })
      );
      await insertEntry(db, movieEntry({ tmdbId: 1396 })); // Film mit gleicher ID — anderer Typ!

      const tvEntries = await listEntriesForMedia(db, 'tv', 1396);
      expect(tvEntries).toHaveLength(2);
    });
  });

  describe('watchlist', () => {
    it('add ist idempotent, remove entfernt', async () => {
      await addToWatchlist(db, 'tv', 1396);
      await addToWatchlist(db, 'tv', 1396);
      expect(await isOnWatchlist(db, 'tv', 1396)).toBe(true);
      expect(await listWatchlist(db)).toHaveLength(1);

      await removeFromWatchlist(db, 'tv', 1396);
      expect(await isOnWatchlist(db, 'tv', 1396)).toBe(false);
    });
  });

  describe('media_cache', () => {
    it('upsert überschreibt bestehende Einträge', async () => {
      const base = {
        mediaType: 'movie' as const,
        tmdbId: 603,
        payload: { title: 'The Matrix' },
        title: 'The Matrix',
        posterPath: '/p1.jpg',
        releaseDate: '1999-03-31',
        runtimeMinutes: 136,
        genres: ['Action', 'Science-Fiction'],
      };
      await upsertCachedMedia(db, base);
      await upsertCachedMedia(db, { ...base, title: 'Matrix', posterPath: '/p2.jpg' });

      const cached = await getCachedMedia(db, 'movie', 603);
      expect(cached?.title).toBe('Matrix');
      expect(cached?.posterPath).toBe('/p2.jpg');
      expect(cached?.genres).toEqual(['Action', 'Science-Fiction']);
      expect(cached && isFresh(cached, 1)).toBe(true);
    });

    it('getCachedMedia liefert null für Unbekanntes', async () => {
      expect(await getCachedMedia(db, 'tv', 999999)).toBeNull();
    });
  });

  describe('settings', () => {
    it('set/get mit Überschreiben', async () => {
      expect(await getSetting(db, 'region')).toBeNull();
      await setSetting(db, 'region', 'DE');
      await setSetting(db, 'region', 'AT');
      expect(await getSetting(db, 'region')).toBe('AT');
    });
  });
});
