import type { DbClient } from '@/data/db-client';

/**
 * Fortschritt beim Serienschauen.
 *
 * Ein Häkchen an einer Episode ist ein Eintrag mit `scope='episode'` und
 * ohne Rating — dieselbe Tabelle wie Bewertungen, kein Sonderschema.
 * Das Häkchen zu entfernen löscht nur solche reinen Seh-Marker; bewertete
 * oder kommentierte Episoden bleiben erhalten, weil sie bewusst angelegt
 * wurden und nicht durch ein Antippen verschwinden dürfen.
 */

/** Schlüssel "staffel-episode", z. B. "5-14". */
export type EpisodeKey = `${number}-${number}`;

export function episodeKey(seasonNumber: number, episodeNumber: number): EpisodeKey {
  return `${seasonNumber}-${episodeNumber}`;
}

/** Alle gesehenen Episoden einer Serie. */
export async function getWatchedEpisodes(
  db: DbClient,
  tmdbId: number
): Promise<Set<EpisodeKey>> {
  const rows = await db.getAllAsync<{ season_number: number; episode_number: number }>(
    `SELECT DISTINCT season_number, episode_number
     FROM entries
     WHERE media_type = 'tv' AND tmdb_id = ? AND scope = 'episode' AND status = 'watched'`,
    [tmdbId]
  );
  return new Set(rows.map((row) => episodeKey(row.season_number, row.episode_number)));
}

/** Anzahl gesehener Episoden je Staffel. */
export async function getSeasonProgress(
  db: DbClient,
  tmdbId: number
): Promise<Map<number, number>> {
  const rows = await db.getAllAsync<{ season_number: number; watched: number }>(
    `SELECT season_number, COUNT(DISTINCT episode_number) AS watched
     FROM entries
     WHERE media_type = 'tv' AND tmdb_id = ? AND scope = 'episode' AND status = 'watched'
     GROUP BY season_number`,
    [tmdbId]
  );
  return new Map(rows.map((row) => [row.season_number, row.watched]));
}

function today(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/**
 * Hakt eine Episode ab. Ist sie schon abgehakt, passiert nichts —
 * die Tabelle hat bewusst keinen UNIQUE-Constraint, damit Rewatches an
 * verschiedenen Tagen möglich bleiben, deshalb prüft das Insert selbst.
 */
export async function markEpisodeWatched(
  db: DbClient,
  tmdbId: number,
  seasonNumber: number,
  episodeNumber: number
): Promise<void> {
  await db.runAsync(
    `INSERT INTO entries
       (media_type, tmdb_id, scope, season_number, episode_number, watched_at, status)
     SELECT 'tv', ?, 'episode', ?, ?, ?, 'watched'
     WHERE NOT EXISTS (
       SELECT 1 FROM entries
       WHERE media_type = 'tv' AND tmdb_id = ? AND scope = 'episode'
         AND season_number = ? AND episode_number = ? AND status = 'watched'
     )`,
    [tmdbId, seasonNumber, episodeNumber, today(), tmdbId, seasonNumber, episodeNumber]
  );
}

/** Entfernt nur reine Seh-Marker — Bewertungen und Reviews bleiben. */
export async function unmarkEpisodeWatched(
  db: DbClient,
  tmdbId: number,
  seasonNumber: number,
  episodeNumber: number
): Promise<void> {
  await db.runAsync(
    `DELETE FROM entries
     WHERE media_type = 'tv' AND tmdb_id = ? AND scope = 'episode'
       AND season_number = ? AND episode_number = ?
       AND rating IS NULL AND review_text IS NULL`,
    [tmdbId, seasonNumber, episodeNumber]
  );
}

/** Hakt eine ganze Staffel ab. Bereits gesehene Episoden bleiben unberührt. */
export async function markSeasonWatched(
  db: DbClient,
  tmdbId: number,
  seasonNumber: number,
  episodeNumbers: number[]
): Promise<void> {
  for (const episodeNumber of episodeNumbers) {
    await markEpisodeWatched(db, tmdbId, seasonNumber, episodeNumber);
  }
}

export async function unmarkSeasonWatched(
  db: DbClient,
  tmdbId: number,
  seasonNumber: number
): Promise<void> {
  await db.runAsync(
    `DELETE FROM entries
     WHERE media_type = 'tv' AND tmdb_id = ? AND scope = 'episode' AND season_number = ?
       AND rating IS NULL AND review_text IS NULL`,
    [tmdbId, seasonNumber]
  );
}

/** Bewertung einer Serie insgesamt, falls vorhanden (neueste zuerst). */
export async function getSeriesRating(
  db: DbClient,
  tmdbId: number
): Promise<number | null> {
  const row = await db.getFirstAsync<{ rating: number | null }>(
    `SELECT rating FROM entries
     WHERE media_type = 'tv' AND tmdb_id = ? AND scope = 'title' AND rating IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`,
    [tmdbId]
  );
  return row?.rating ?? null;
}

/** Bewertungen je Staffel. */
export async function getSeasonRatings(
  db: DbClient,
  tmdbId: number
): Promise<Map<number, number>> {
  const rows = await db.getAllAsync<{ season_number: number; rating: number }>(
    `SELECT e.season_number, e.rating
     FROM entries e
     WHERE e.media_type = 'tv' AND e.tmdb_id = ? AND e.scope = 'season' AND e.rating IS NOT NULL
       AND e.id = (
         SELECT e2.id FROM entries e2
         WHERE e2.media_type = 'tv' AND e2.tmdb_id = e.tmdb_id AND e2.scope = 'season'
           AND e2.season_number = e.season_number AND e2.rating IS NOT NULL
         ORDER BY e2.created_at DESC, e2.id DESC LIMIT 1
       )`,
    [tmdbId]
  );
  return new Map(rows.map((row) => [row.season_number, row.rating]));
}

/** Markiert eine Serie als abgebrochen, mit Grund. */
export async function markSeriesDropped(
  db: DbClient,
  tmdbId: number,
  reason: string | null
): Promise<void> {
  await db.runAsync(
    `INSERT INTO entries (media_type, tmdb_id, scope, status, dropped_reason, watched_at)
     VALUES ('tv', ?, 'title', 'dropped', ?, ?)`,
    [tmdbId, reason, today()]
  );
}

/** Ist die Serie als abgebrochen markiert? Liefert den Grund mit. */
export async function getDroppedStatus(
  db: DbClient,
  tmdbId: number
): Promise<{ dropped: boolean; reason: string | null }> {
  const row = await db.getFirstAsync<{ dropped_reason: string | null }>(
    `SELECT dropped_reason FROM entries
     WHERE media_type = 'tv' AND tmdb_id = ? AND scope = 'title' AND status = 'dropped'
     ORDER BY created_at DESC LIMIT 1`,
    [tmdbId]
  );
  return row ? { dropped: true, reason: row.dropped_reason } : { dropped: false, reason: null };
}
