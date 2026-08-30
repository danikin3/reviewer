import type { DbClient } from '@/data/db-client';
import type { MediaType, WatchlistItem } from '@/types/media';

interface WatchlistRow {
  media_type: MediaType;
  tmdb_id: number;
  created_at: string;
}

function rowToItem(row: WatchlistRow): WatchlistItem {
  return { mediaType: row.media_type, tmdbId: row.tmdb_id, createdAt: row.created_at };
}

/** Idempotent — doppeltes Hinzufügen ist kein Fehler. */
export async function addToWatchlist(
  db: DbClient,
  mediaType: MediaType,
  tmdbId: number
): Promise<void> {
  await db.runAsync(
    'INSERT OR IGNORE INTO watchlist (media_type, tmdb_id) VALUES (?, ?)',
    [mediaType, tmdbId]
  );
}

export async function removeFromWatchlist(
  db: DbClient,
  mediaType: MediaType,
  tmdbId: number
): Promise<void> {
  await db.runAsync('DELETE FROM watchlist WHERE media_type = ? AND tmdb_id = ?', [
    mediaType,
    tmdbId,
  ]);
}

export async function isOnWatchlist(
  db: DbClient,
  mediaType: MediaType,
  tmdbId: number
): Promise<boolean> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT 1 AS n FROM watchlist WHERE media_type = ? AND tmdb_id = ?',
    [mediaType, tmdbId]
  );
  return row !== null;
}

export async function listWatchlist(db: DbClient): Promise<WatchlistItem[]> {
  const rows = await db.getAllAsync<WatchlistRow>(
    'SELECT * FROM watchlist ORDER BY created_at DESC',
    []
  );
  return rows.map(rowToItem);
}
