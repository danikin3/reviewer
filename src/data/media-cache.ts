import type { DbClient } from '@/data/db-client';
import type { CachedMedia, MediaType } from '@/types/media';

interface MediaCacheRow {
  media_type: MediaType;
  tmdb_id: number;
  payload: string;
  title: string;
  poster_path: string | null;
  release_date: string | null;
  runtime_minutes: number | null;
  genres: string;
  fetched_at: string;
}

function rowToMedia(row: MediaCacheRow): CachedMedia {
  return {
    mediaType: row.media_type,
    tmdbId: row.tmdb_id,
    payload: JSON.parse(row.payload) as unknown,
    title: row.title,
    posterPath: row.poster_path,
    releaseDate: row.release_date,
    runtimeMinutes: row.runtime_minutes,
    genres: JSON.parse(row.genres) as string[],
    fetchedAt: row.fetched_at,
  };
}

export async function upsertCachedMedia(
  db: DbClient,
  media: Omit<CachedMedia, 'fetchedAt'>
): Promise<void> {
  await db.runAsync(
    `INSERT INTO media_cache
       (media_type, tmdb_id, payload, title, poster_path, release_date, runtime_minutes, genres,
        fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     ON CONFLICT (media_type, tmdb_id) DO UPDATE SET
       payload = excluded.payload,
       title = excluded.title,
       poster_path = excluded.poster_path,
       release_date = excluded.release_date,
       runtime_minutes = excluded.runtime_minutes,
       genres = excluded.genres,
       fetched_at = excluded.fetched_at`,
    [
      media.mediaType,
      media.tmdbId,
      JSON.stringify(media.payload),
      media.title,
      media.posterPath,
      media.releaseDate,
      media.runtimeMinutes,
      JSON.stringify(media.genres),
    ]
  );
}

export async function getCachedMedia(
  db: DbClient,
  mediaType: MediaType,
  tmdbId: number
): Promise<CachedMedia | null> {
  const row = await db.getFirstAsync<MediaCacheRow>(
    'SELECT * FROM media_cache WHERE media_type = ? AND tmdb_id = ?',
    [mediaType, tmdbId]
  );
  return row ? rowToMedia(row) : null;
}

/** true, wenn der Cache-Eintrag jünger als maxAgeHours ist. */
export function isFresh(media: CachedMedia, maxAgeHours: number): boolean {
  const ageMs = Date.now() - new Date(media.fetchedAt).getTime();
  return ageMs < maxAgeHours * 60 * 60 * 1000;
}
