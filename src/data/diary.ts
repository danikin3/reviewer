import type { DbClient } from '@/data/db-client';
import { upsertCachedMedia } from '@/data/media-cache';
import { insertEntry } from '@/data/entries';
import type {
  Entry,
  EntryScope,
  EntryStatus,
  EntryWithMedia,
  MediaDetails,
  MediaType,
  NewEntry,
  Rating,
} from '@/types/media';

interface JoinedRow {
  id: number;
  media_type: MediaType;
  tmdb_id: number;
  scope: EntryScope;
  season_number: number | null;
  episode_number: number | null;
  rating: number | null;
  review_text: string | null;
  has_spoilers: number;
  watched_at: string | null;
  is_rewatch: number;
  status: EntryStatus;
  dropped_reason: string | null;
  tags: string;
  created_at: string;
  updated_at: string;
  cached_title: string | null;
  cached_poster: string | null;
  cached_release: string | null;
}

function rowToEntryWithMedia(row: JoinedRow): EntryWithMedia {
  const entry: Entry = {
    id: row.id,
    mediaType: row.media_type,
    tmdbId: row.tmdb_id,
    scope: row.scope,
    seasonNumber: row.season_number,
    episodeNumber: row.episode_number,
    rating: row.rating as Rating | null,
    reviewText: row.review_text,
    hasSpoilers: row.has_spoilers === 1,
    watchedAt: row.watched_at,
    isRewatch: row.is_rewatch === 1,
    status: row.status,
    droppedReason: row.dropped_reason,
    tags: JSON.parse(row.tags) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  const year = row.cached_release ? Number(row.cached_release.slice(0, 4)) : null;

  return {
    entry,
    // Fällt der Cache aus, bleibt der Eintrag sichtbar statt zu verschwinden.
    title: row.cached_title ?? 'Unbekannter Titel',
    posterPath: row.cached_poster,
    year: year !== null && Number.isFinite(year) ? year : null,
  };
}

const JOIN_SELECT = `
  SELECT e.*,
         m.title AS cached_title,
         m.poster_path AS cached_poster,
         m.release_date AS cached_release
  FROM entries e
  LEFT JOIN media_cache m
    ON m.media_type = e.media_type AND m.tmdb_id = e.tmdb_id
`;

/** Tagebuch: alle Einträge chronologisch, Keyset-paginiert. */
export async function listDiary(
  db: DbClient,
  options: { limit: number; before?: { createdAt: string; id: number } }
): Promise<EntryWithMedia[]> {
  const { limit, before } = options;
  const rows = before
    ? await db.getAllAsync<JoinedRow>(
        `${JOIN_SELECT}
         WHERE (e.created_at, e.id) < (?, ?)
         ORDER BY e.created_at DESC, e.id DESC
         LIMIT ?`,
        [before.createdAt, before.id, limit]
      )
    : await db.getAllAsync<JoinedRow>(
        `${JOIN_SELECT} ORDER BY e.created_at DESC, e.id DESC LIMIT ?`,
        [limit]
      );
  return rows.map(rowToEntryWithMedia);
}

/**
 * Poster-Grid fürs Profil: nur bewertete Titel-Einträge (keine Staffeln
 * oder Episoden), damit das Raster die Sammlung zeigt, nicht jede Folge.
 */
export async function listRatedTitles(
  db: DbClient,
  options: { limit: number }
): Promise<EntryWithMedia[]> {
  const rows = await db.getAllAsync<JoinedRow>(
    `${JOIN_SELECT}
     WHERE e.scope = 'title' AND e.rating IS NOT NULL
     ORDER BY e.created_at DESC, e.id DESC
     LIMIT ?`,
    [options.limit]
  );
  return rows.map(rowToEntryWithMedia);
}

/** Watchlist mit Titel und Poster — dieselbe Darstellung wie das Tagebuch. */
export async function listWatchlistWithMedia(db: DbClient): Promise<
  { mediaType: MediaType; tmdbId: number; title: string; posterPath: string | null; year: number | null }[]
> {
  const rows = await db.getAllAsync<{
    media_type: MediaType;
    tmdb_id: number;
    cached_title: string | null;
    cached_poster: string | null;
    cached_release: string | null;
  }>(
    `SELECT w.media_type, w.tmdb_id,
            m.title AS cached_title,
            m.poster_path AS cached_poster,
            m.release_date AS cached_release
     FROM watchlist w
     LEFT JOIN media_cache m ON m.media_type = w.media_type AND m.tmdb_id = w.tmdb_id
     ORDER BY w.created_at DESC`,
    []
  );

  return rows.map((row) => {
    const year = row.cached_release ? Number(row.cached_release.slice(0, 4)) : null;
    return {
      mediaType: row.media_type,
      tmdbId: row.tmdb_id,
      title: row.cached_title ?? 'Unbekannter Titel',
      posterPath: row.cached_poster,
      year: year !== null && Number.isFinite(year) ? year : null,
    };
  });
}

/**
 * Setzt einen Titel auf die Watchlist und cacht dabei seine Metadaten —
 * sonst stünde die Watchlist später ohne Titel und Poster da.
 */
export async function addToWatchlistWithMedia(
  db: DbClient,
  details: MediaDetails
): Promise<void> {
  await upsertCachedMedia(db, {
    mediaType: details.mediaType,
    tmdbId: details.tmdbId,
    payload: details,
    title: details.title,
    posterPath: details.posterPath,
    releaseDate: details.year !== null ? `${details.year}-01-01` : null,
    runtimeMinutes: details.runtimeMinutes,
    genres: details.genres,
  });
  await db.runAsync(
    'INSERT OR IGNORE INTO watchlist (media_type, tmdb_id) VALUES (?, ?)',
    [details.mediaType, details.tmdbId]
  );
}

export interface RatingInput {
  scope: EntryScope;
  seasonNumber: number | null;
  episodeNumber: number | null;
  rating: Rating | null;
  reviewText: string | null;
  hasSpoilers: boolean;
  watchedAt: string | null;
  isRewatch: boolean;
  status: EntryStatus;
  droppedReason: string | null;
  tags: string[];
}

/**
 * Speichert eine Bewertung und legt die Titel-Metadaten im Cache ab.
 * Beides gehört zusammen: ohne Cache hätte das Tagebuch später weder
 * Titel noch Poster anzuzeigen.
 */
export async function saveRating(
  db: DbClient,
  details: MediaDetails,
  input: RatingInput
): Promise<Entry> {
  await upsertCachedMedia(db, {
    mediaType: details.mediaType,
    tmdbId: details.tmdbId,
    payload: details,
    title: details.title,
    posterPath: details.posterPath,
    releaseDate: details.year !== null ? `${details.year}-01-01` : null,
    runtimeMinutes: details.runtimeMinutes,
    genres: details.genres,
  });

  const entry: NewEntry = {
    mediaType: details.mediaType,
    tmdbId: details.tmdbId,
    ...input,
  };
  return insertEntry(db, entry);
}
