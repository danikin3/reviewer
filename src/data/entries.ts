import type { DbClient, SqlValue } from '@/data/db-client';
import type { Entry, EntryScope, EntryStatus, MediaType, NewEntry, Rating } from '@/types/media';

interface EntryRow {
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
}

function rowToEntry(row: EntryRow): Entry {
  return {
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
}

export async function insertEntry(db: DbClient, entry: NewEntry): Promise<Entry> {
  const result = await db.runAsync(
    `INSERT INTO entries (
       media_type, tmdb_id, scope, season_number, episode_number,
       rating, review_text, has_spoilers, watched_at, is_rewatch,
       status, dropped_reason, tags
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.mediaType,
      entry.tmdbId,
      entry.scope,
      entry.seasonNumber,
      entry.episodeNumber,
      entry.rating,
      entry.reviewText,
      entry.hasSpoilers ? 1 : 0,
      entry.watchedAt,
      entry.isRewatch ? 1 : 0,
      entry.status,
      entry.droppedReason,
      JSON.stringify(entry.tags),
    ]
  );
  const created = await getEntryById(db, result.lastInsertRowId);
  if (!created) {
    throw new Error(`Eintrag ${result.lastInsertRowId} nach Insert nicht gefunden`);
  }
  return created;
}

export async function updateEntry(
  db: DbClient,
  id: number,
  patch: Partial<NewEntry>
): Promise<void> {
  const fields: string[] = [];
  const params: SqlValue[] = [];

  const map: Record<string, SqlValue | undefined> = {
    rating: patch.rating,
    review_text: patch.reviewText,
    has_spoilers: patch.hasSpoilers === undefined ? undefined : patch.hasSpoilers ? 1 : 0,
    watched_at: patch.watchedAt,
    is_rewatch: patch.isRewatch === undefined ? undefined : patch.isRewatch ? 1 : 0,
    status: patch.status,
    dropped_reason: patch.droppedReason,
    tags: patch.tags === undefined ? undefined : JSON.stringify(patch.tags),
  };
  for (const [column, value] of Object.entries(map)) {
    if (value !== undefined) {
      fields.push(`${column} = ?`);
      params.push(value);
    }
  }
  if (fields.length === 0) return;

  fields.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`);
  params.push(id);
  await db.runAsync(`UPDATE entries SET ${fields.join(', ')} WHERE id = ?`, params);
}

export async function deleteEntry(db: DbClient, id: number): Promise<void> {
  await db.runAsync('DELETE FROM entries WHERE id = ?', [id]);
}

export async function getEntryById(db: DbClient, id: number): Promise<Entry | null> {
  const row = await db.getFirstAsync<EntryRow>('SELECT * FROM entries WHERE id = ?', [id]);
  return row ? rowToEntry(row) : null;
}

/** Keyset-Pagination über (created_at, id) — nie ganze Tabellen laden. */
export async function listRecentEntries(
  db: DbClient,
  options: { limit: number; before?: { createdAt: string; id: number } }
): Promise<Entry[]> {
  const { limit, before } = options;
  const rows = before
    ? await db.getAllAsync<EntryRow>(
        `SELECT * FROM entries
         WHERE (created_at, id) < (?, ?)
         ORDER BY created_at DESC, id DESC
         LIMIT ?`,
        [before.createdAt, before.id, limit]
      )
    : await db.getAllAsync<EntryRow>(
        'SELECT * FROM entries ORDER BY created_at DESC, id DESC LIMIT ?',
        [limit]
      );
  return rows.map(rowToEntry);
}

/** Alle Einträge zu einem Titel (alle Ebenen), neueste zuerst. */
export async function listEntriesForMedia(
  db: DbClient,
  mediaType: MediaType,
  tmdbId: number
): Promise<Entry[]> {
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT * FROM entries
     WHERE media_type = ? AND tmdb_id = ?
     ORDER BY created_at DESC, id DESC`,
    [mediaType, tmdbId]
  );
  return rows.map(rowToEntry);
}

export async function countEntries(db: DbClient): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM entries', []);
  return row?.n ?? 0;
}
