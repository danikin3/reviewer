import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  addToWatchlistWithMedia,
  listDiary,
  listRatedTitles,
  listWatchlistWithMedia,
  saveRating,
  type RatingInput,
} from '@/data/diary';
import { getCachedMedia } from '@/data/media-cache';
import { migrateDb } from '@/data/migrations';
import type { MediaDetails, Rating } from '@/types/media';
import { NodeDbAdapter } from './node-db-adapter';

function details(overrides: Partial<MediaDetails> = {}): MediaDetails {
  return {
    mediaType: 'movie',
    tmdbId: 603,
    title: 'Matrix',
    year: 1999,
    overview: 'Neo',
    posterPath: '/m.jpg',
    backdropPath: '/b.jpg',
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

describe('saveRating', () => {
  let db: NodeDbAdapter;

  beforeEach(async () => {
    db = new NodeDbAdapter();
    await migrateDb(db);
  });

  afterEach(() => {
    db.close();
  });

  it('legt Eintrag und Metadaten-Cache gemeinsam an', async () => {
    const entry = await saveRating(db, details(), input());

    expect(entry.rating).toBe(4.5);
    const cached = await getCachedMedia(db, 'movie', 603);
    expect(cached?.title).toBe('Matrix');
    expect(cached?.posterPath).toBe('/m.jpg');
    expect(cached?.runtimeMinutes).toBe(136);
  });

  it('liefert Titel und Poster im Tagebuch ohne TMDB-Anfrage', async () => {
    await saveRating(db, details(), input());

    const diary = await listDiary(db, { limit: 10 });
    expect(diary).toHaveLength(1);
    expect(diary[0].title).toBe('Matrix');
    expect(diary[0].posterPath).toBe('/m.jpg');
    expect(diary[0].year).toBe(1999);
    expect(diary[0].entry.rating).toBe(4.5);
  });

  it('aktualisiert den Cache bei erneuter Bewertung desselben Titels', async () => {
    await saveRating(db, details(), input());
    await saveRating(db, details({ title: 'The Matrix', posterPath: '/neu.jpg' }), input({ isRewatch: true, watchedAt: '2026-08-31' }));

    const diary = await listDiary(db, { limit: 10 });
    expect(diary).toHaveLength(2);
    // Beide Einträge zeigen den aktualisierten Titel
    expect(diary.every((item) => item.title === 'The Matrix')).toBe(true);
  });

  it('zeigt Einträge auch ohne Cache-Treffer statt sie zu verschlucken', async () => {
    await db.runAsync(
      "INSERT INTO entries (media_type, tmdb_id, scope, rating) VALUES ('tv', 999, 'title', 3)",
      []
    );
    const diary = await listDiary(db, { limit: 10 });
    expect(diary).toHaveLength(1);
    expect(diary[0].title).toBe('Unbekannter Titel');
    expect(diary[0].posterPath).toBeNull();
  });
});

describe('listRatedTitles', () => {
  let db: NodeDbAdapter;

  beforeEach(async () => {
    db = new NodeDbAdapter();
    await migrateDb(db);
  });

  afterEach(() => {
    db.close();
  });

  it('zeigt nur bewertete Titel — keine Staffeln, Episoden oder reine Reviews', async () => {
    const series = details({ mediaType: 'tv', tmdbId: 1396, title: 'Breaking Bad' });
    await saveRating(db, series, input());
    await saveRating(db, series, input({ scope: 'season', seasonNumber: 1 }));
    await saveRating(db, series, input({ scope: 'episode', seasonNumber: 1, episodeNumber: 2 }));
    await saveRating(db, details(), input({ rating: null, reviewText: 'Ohne Sterne' }));

    const grid = await listRatedTitles(db, { limit: 50 });

    expect(grid).toHaveLength(1);
    expect(grid[0].entry.scope).toBe('title');
    expect(grid[0].title).toBe('Breaking Bad');
  });

  it('sortiert die neuesten Bewertungen nach vorne', async () => {
    await saveRating(db, details({ tmdbId: 1, title: 'Erster' }), input());
    await saveRating(db, details({ tmdbId: 2, title: 'Zweiter' }), input());

    const grid = await listRatedTitles(db, { limit: 50 });
    expect(grid[0].title).toBe('Zweiter');
  });
});

describe('Watchlist mit Metadaten', () => {
  let db: NodeDbAdapter;

  beforeEach(async () => {
    db = new NodeDbAdapter();
    await migrateDb(db);
  });

  afterEach(() => {
    db.close();
  });

  it('cacht die Metadaten beim Setzen auf die Watchlist', async () => {
    await addToWatchlistWithMedia(db, details({ mediaType: 'tv', tmdbId: 1396, title: 'Breaking Bad' }));

    const list = await listWatchlistWithMedia(db);
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('Breaking Bad');
    expect(list[0].posterPath).toBe('/m.jpg');
    expect(list[0].mediaType).toBe('tv');
  });

  it('bleibt beim doppelten Hinzufügen bei einem Eintrag', async () => {
    await addToWatchlistWithMedia(db, details());
    await addToWatchlistWithMedia(db, details());
    expect(await listWatchlistWithMedia(db)).toHaveLength(1);
  });

  it('mischt Filme und Serien in einer Liste', async () => {
    await addToWatchlistWithMedia(db, details());
    await addToWatchlistWithMedia(db, details({ mediaType: 'tv', tmdbId: 1396, title: 'Breaking Bad' }));

    const list = await listWatchlistWithMedia(db);
    expect(list).toHaveLength(2);
    expect(new Set(list.map((item) => item.mediaType))).toEqual(new Set(['movie', 'tv']));
  });
});
