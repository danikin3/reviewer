import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { saveRating, type RatingInput } from '@/data/diary';
import { migrateDb } from '@/data/migrations';
import { markSeasonWatched, markSeriesDropped } from '@/data/series-progress';
import { computeStats, formatWatchTime } from '@/data/stats';
import type { MediaDetails, Rating } from '@/types/media';

import { NodeDbAdapter } from './node-db-adapter';

function movie(overrides: Partial<MediaDetails> = {}): MediaDetails {
  return {
    mediaType: 'movie',
    tmdbId: 603,
    title: 'Matrix',
    year: 1999,
    overview: null,
    posterPath: null,
    backdropPath: null,
    genres: ['Action', 'Science-Fiction'],
    tmdbScore: 8.2,
    cast: [
      { tmdbId: 1, name: 'Keanu Reeves', character: 'Neo', profilePath: null },
      { tmdbId: 2, name: 'Carrie-Anne Moss', character: 'Trinity', profilePath: null },
    ],
    trailerKey: null,
    runtimeMinutes: 120,
    seasonCount: null,
    episodeCount: null,
    seasons: [],
    directors: ['Lana Wachowski'],
    ...overrides,
  };
}

function series(overrides: Partial<MediaDetails> = {}): MediaDetails {
  return movie({
    mediaType: 'tv',
    tmdbId: 1396,
    title: 'Breaking Bad',
    genres: ['Drama'],
    runtimeMinutes: 45,
    seasonCount: 5,
    episodeCount: 62,
    directors: ['Vince Gilligan'],
    cast: [{ tmdbId: 3, name: 'Bryan Cranston', character: 'Walter White', profilePath: null }],
    ...overrides,
  });
}

function input(overrides: Partial<RatingInput> = {}): RatingInput {
  return {
    scope: 'title',
    seasonNumber: null,
    episodeNumber: null,
    rating: 4 as Rating,
    reviewText: null,
    hasSpoilers: false,
    watchedAt: '2026-05-10',
    isRewatch: false,
    status: 'watched',
    droppedReason: null,
    tags: [],
    ...overrides,
  };
}

describe('computeStats', () => {
  let db: NodeDbAdapter;

  beforeEach(async () => {
    db = new NodeDbAdapter();
    await migrateDb(db);
  });

  afterEach(() => {
    db.close();
  });

  it('liefert bei leerer Datenbank überall Nullen', async () => {
    const stats = await computeStats(db);

    expect(stats.movieCount).toBe(0);
    expect(stats.seriesCount).toBe(0);
    expect(stats.watchTimeMinutes).toBe(0);
    expect(stats.averageRating).toBeNull();
    expect(stats.topGenres).toEqual([]);
    // Die Verteilung hat trotzdem alle zehn Stufen
    expect(stats.ratingDistribution).toHaveLength(10);
    expect(stats.ratingDistribution.every((bucket) => bucket.count === 0)).toBe(true);
  });

  it('zählt Filme und summiert ihre Laufzeit', async () => {
    await saveRating(db, movie({ tmdbId: 1, runtimeMinutes: 120 }), input());
    await saveRating(db, movie({ tmdbId: 2, runtimeMinutes: 90 }), input());

    const stats = await computeStats(db);

    expect(stats.movieCount).toBe(2);
    expect(stats.watchTimeMinutes).toBe(210);
  });

  it('zählt denselben Film bei einem Rewatch nur einmal', async () => {
    await saveRating(db, movie({ tmdbId: 1, runtimeMinutes: 120 }), input());
    await saveRating(db, movie({ tmdbId: 1, runtimeMinutes: 120 }), input({ isRewatch: true, watchedAt: '2026-06-01' }));

    const stats = await computeStats(db);
    expect(stats.movieCount).toBe(1);
    expect(stats.watchTimeMinutes).toBe(120);
  });

  it('rechnet Serienzeit über abgehakte Episoden', async () => {
    await saveRating(db, series(), input({ rating: null, reviewText: 'Merker' }));
    await markSeasonWatched(db, 1396, 1, [1, 2, 3, 4, 5, 6, 7]);

    const stats = await computeStats(db);

    expect(stats.seriesCount).toBe(1);
    expect(stats.episodeCount).toBe(7);
    expect(stats.watchTimeMinutes).toBe(7 * 45);
  });

  it('zählt eine nur insgesamt bewertete Serie mit voller Laufzeit', async () => {
    await saveRating(db, series(), input());

    const stats = await computeStats(db);
    expect(stats.watchTimeMinutes).toBe(62 * 45);
  });

  it('lässt abgehakte Folgen die Gesamtbewertung überstimmen', async () => {
    await saveRating(db, series(), input());
    await markSeasonWatched(db, 1396, 1, [1, 2, 3]);

    const stats = await computeStats(db);
    // Weder 62+3 (doppelt) noch 62 (erfundene Sehzeit): die drei Folgen,
    // die der Nutzer tatsächlich abgehakt hat.
    expect(stats.watchTimeMinutes).toBe(3 * 45);
  });

  it('verteilt Bewertungen auf die Halbschritt-Stufen', async () => {
    await saveRating(db, movie({ tmdbId: 1 }), input({ rating: 4.5 }));
    await saveRating(db, movie({ tmdbId: 2 }), input({ rating: 4.5 }));
    await saveRating(db, movie({ tmdbId: 3 }), input({ rating: 2 }));

    const stats = await computeStats(db);
    const byRating = new Map(stats.ratingDistribution.map((b) => [b.rating, b.count]));

    expect(byRating.get(4.5)).toBe(2);
    expect(byRating.get(2)).toBe(1);
    expect(byRating.get(5)).toBe(0);
    // (4,5 + 4,5 + 2) / 3 = 3,666… → 3,7
    expect(stats.averageRating).toBe(3.7);
  });

  it('zählt Genres, Regie und Cast pro Titel nur einmal', async () => {
    await saveRating(db, series(), input());
    // 20 abgehakte Folgen derselben Serie dürfen "Drama" nicht 20-mal zählen
    await markSeasonWatched(db, 1396, 1, Array.from({ length: 20 }, (_, i) => i + 1));

    const stats = await computeStats(db);

    expect(stats.topGenres).toEqual([{ name: 'Drama', count: 1 }]);
    expect(stats.topDirectors).toEqual([{ name: 'Vince Gilligan', count: 1 }]);
    expect(stats.topActors).toEqual([{ name: 'Bryan Cranston', count: 1 }]);
  });

  it('sortiert Top-Listen nach Häufigkeit', async () => {
    await saveRating(db, movie({ tmdbId: 1, genres: ['Action', 'Drama'] }), input());
    await saveRating(db, movie({ tmdbId: 2, genres: ['Action'] }), input());
    await saveRating(db, movie({ tmdbId: 3, genres: ['Action'] }), input());
    await saveRating(db, movie({ tmdbId: 4, genres: ['Drama'] }), input());

    const stats = await computeStats(db);
    expect(stats.topGenres).toEqual([
      { name: 'Action', count: 3 },
      { name: 'Drama', count: 2 },
    ]);
  });

  it('gruppiert Bewertungen nach Jahr und Monat', async () => {
    await saveRating(db, movie({ tmdbId: 1 }), input({ watchedAt: '2025-03-15' }));
    await saveRating(db, movie({ tmdbId: 2 }), input({ watchedAt: '2026-05-10' }));
    await saveRating(db, movie({ tmdbId: 3 }), input({ watchedAt: '2026-05-20' }));

    const stats = await computeStats(db);

    expect(stats.perYear).toEqual([
      { year: 2026, count: 2 },
      { year: 2025, count: 1 },
    ]);
    expect(stats.perMonth.find((m) => m.month === 5)?.count).toBe(2);
    expect(stats.perMonth.find((m) => m.month === 3)?.count).toBe(1);
  });

  it('grenzt den Jahres-Rückblick korrekt ein', async () => {
    await saveRating(db, movie({ tmdbId: 1, runtimeMinutes: 100 }), input({ watchedAt: '2025-03-15' }));
    await saveRating(db, movie({ tmdbId: 2, runtimeMinutes: 200 }), input({ watchedAt: '2026-05-10' }));

    const stats2026 = await computeStats(db, { year: 2026 });

    expect(stats2026.movieCount).toBe(1);
    expect(stats2026.watchTimeMinutes).toBe(200);
    // perYear zeigt weiterhin alle Jahre, damit die Auswahl bedienbar bleibt
    expect(stats2026.perYear).toHaveLength(2);
  });

  it('zählt abgebrochene Serien getrennt', async () => {
    await markSeriesDropped(db, 1396, 'Zu zäh');
    await saveRating(db, movie({ tmdbId: 1 }), input());

    const stats = await computeStats(db);
    expect(stats.droppedCount).toBe(1);
    // Der Abbruch zählt nicht als gesehene Serie
    expect(stats.seriesCount).toBe(0);
  });

  it('übersteht einen beschädigten Cache-Eintrag', async () => {
    await saveRating(db, movie({ tmdbId: 1 }), input());
    await db.runAsync("UPDATE media_cache SET payload = 'kein json' WHERE tmdb_id = 1", []);

    const stats = await computeStats(db);
    expect(stats.movieCount).toBe(1);
    expect(stats.topDirectors).toEqual([]);
  });
});

describe('formatWatchTime', () => {
  it.each([
    [0, '0 Std.'],
    [45, '45 Min.'],
    [120, '2 Std.'],
    [1440, '1 Tag'],
    [1500, '1 Tag 1 Std.'],
    [4500, '3 Tage 3 Std.'],
  ])('formatiert %s Minuten als "%s"', (minutes, expected) => {
    expect(formatWatchTime(minutes)).toBe(expected);
  });
});
