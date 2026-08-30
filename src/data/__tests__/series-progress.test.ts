import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { migrateDb } from '@/data/migrations';
import {
  episodeKey,
  getDroppedStatus,
  getSeasonProgress,
  getSeasonRatings,
  getSeriesRating,
  getWatchedEpisodes,
  markEpisodeWatched,
  markSeasonWatched,
  markSeriesDropped,
  unmarkEpisodeWatched,
  unmarkSeasonWatched,
} from '@/data/series-progress';
import { NodeDbAdapter } from './node-db-adapter';

const BREAKING_BAD = 1396;

describe('Serien-Fortschritt', () => {
  let db: NodeDbAdapter;

  beforeEach(async () => {
    db = new NodeDbAdapter();
    await migrateDb(db);
  });

  afterEach(() => {
    db.close();
  });

  it('hakt eine Episode ab und wieder los', async () => {
    await markEpisodeWatched(db, BREAKING_BAD, 1, 1);
    expect(await getWatchedEpisodes(db, BREAKING_BAD)).toEqual(new Set([episodeKey(1, 1)]));

    await unmarkEpisodeWatched(db, BREAKING_BAD, 1, 1);
    expect((await getWatchedEpisodes(db, BREAKING_BAD)).size).toBe(0);
  });

  it('erzeugt beim doppelten Abhaken keinen zweiten Eintrag', async () => {
    await markEpisodeWatched(db, BREAKING_BAD, 1, 1);
    await markEpisodeWatched(db, BREAKING_BAD, 1, 1);
    await markEpisodeWatched(db, BREAKING_BAD, 1, 1);

    const row = await db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM entries WHERE scope = 'episode'",
      []
    );
    expect(row?.n).toBe(1);
  });

  it('löscht beim Loshaken keine bewertete Episode', async () => {
    await db.runAsync(
      `INSERT INTO entries (media_type, tmdb_id, scope, season_number, episode_number, rating, status)
       VALUES ('tv', ?, 'episode', 5, 14, 5, 'watched')`,
      [BREAKING_BAD]
    );

    await unmarkEpisodeWatched(db, BREAKING_BAD, 5, 14);

    // Die bewusste Bewertung überlebt das Antippen
    expect(await getWatchedEpisodes(db, BREAKING_BAD)).toEqual(new Set([episodeKey(5, 14)]));
  });

  it('hakt eine ganze Staffel ab, ohne Bestehendes zu verdoppeln', async () => {
    await markEpisodeWatched(db, BREAKING_BAD, 1, 3);
    await markSeasonWatched(db, BREAKING_BAD, 1, [1, 2, 3, 4, 5, 6, 7]);

    const progress = await getSeasonProgress(db, BREAKING_BAD);
    expect(progress.get(1)).toBe(7);

    const row = await db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM entries WHERE scope = 'episode'",
      []
    );
    expect(row?.n).toBe(7);
  });

  it('zählt den Fortschritt je Staffel getrennt', async () => {
    await markSeasonWatched(db, BREAKING_BAD, 1, [1, 2, 3]);
    await markSeasonWatched(db, BREAKING_BAD, 2, [1]);

    const progress = await getSeasonProgress(db, BREAKING_BAD);
    expect(progress.get(1)).toBe(3);
    expect(progress.get(2)).toBe(1);
    expect(progress.get(3)).toBeUndefined();
  });

  it('nimmt beim Staffel-Loshaken bewertete Episoden aus', async () => {
    await markSeasonWatched(db, BREAKING_BAD, 1, [1, 2, 3]);
    await db.runAsync(
      `INSERT INTO entries (media_type, tmdb_id, scope, season_number, episode_number, rating, status)
       VALUES ('tv', ?, 'episode', 1, 7, 4.5, 'watched')`,
      [BREAKING_BAD]
    );

    await unmarkSeasonWatched(db, BREAKING_BAD, 1);

    const progress = await getSeasonProgress(db, BREAKING_BAD);
    expect(progress.get(1)).toBe(1);
  });

  it('hält die drei Bewertungsebenen auseinander', async () => {
    await db.runAsync(
      "INSERT INTO entries (media_type, tmdb_id, scope, rating) VALUES ('tv', ?, 'title', 5)",
      [BREAKING_BAD]
    );
    await db.runAsync(
      "INSERT INTO entries (media_type, tmdb_id, scope, season_number, rating) VALUES ('tv', ?, 'season', 4, 4.5)",
      [BREAKING_BAD]
    );
    await db.runAsync(
      "INSERT INTO entries (media_type, tmdb_id, scope, season_number, rating) VALUES ('tv', ?, 'season', 5, 5)",
      [BREAKING_BAD]
    );

    expect(await getSeriesRating(db, BREAKING_BAD)).toBe(5);
    const seasons = await getSeasonRatings(db, BREAKING_BAD);
    expect(seasons.get(4)).toBe(4.5);
    expect(seasons.get(5)).toBe(5);
    expect(seasons.size).toBe(2);
  });

  it('nimmt bei mehrfacher Staffelbewertung die neueste', async () => {
    await db.runAsync(
      "INSERT INTO entries (media_type, tmdb_id, scope, season_number, rating, created_at) VALUES ('tv', ?, 'season', 1, 2, '2026-01-01T00:00:00.000Z')",
      [BREAKING_BAD]
    );
    await db.runAsync(
      "INSERT INTO entries (media_type, tmdb_id, scope, season_number, rating, created_at) VALUES ('tv', ?, 'season', 1, 4, '2026-08-01T00:00:00.000Z')",
      [BREAKING_BAD]
    );

    const seasons = await getSeasonRatings(db, BREAKING_BAD);
    expect(seasons.get(1)).toBe(4);
    expect(seasons.size).toBe(1);
  });

  it('merkt sich Abbruch samt Grund', async () => {
    expect(await getDroppedStatus(db, BREAKING_BAD)).toEqual({ dropped: false, reason: null });

    await markSeriesDropped(db, BREAKING_BAD, 'Zu zäh ab Staffel 3');

    expect(await getDroppedStatus(db, BREAKING_BAD)).toEqual({
      dropped: true,
      reason: 'Zu zäh ab Staffel 3',
    });
  });

  it('trennt Fortschritt verschiedener Serien', async () => {
    await markSeasonWatched(db, BREAKING_BAD, 1, [1, 2]);
    await markSeasonWatched(db, 1399, 1, [1]);

    expect((await getWatchedEpisodes(db, BREAKING_BAD)).size).toBe(2);
    expect((await getWatchedEpisodes(db, 1399)).size).toBe(1);
  });
});
