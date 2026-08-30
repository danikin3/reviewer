import type { DbClient } from '@/data/db-client';
import { listDiary } from '@/data/diary';
import type { EntryWithMedia } from '@/types/media';

/**
 * Datenexport und -löschung.
 *
 * Beides ist Pflicht, nicht Kür: Wer seine Bewertungen jahrelang pflegt,
 * muss sie mitnehmen können, und "Alles löschen" muss wirklich alles
 * löschen statt nur die Ansicht zu leeren.
 */

/** Wie viele Einträge exportiert werden — großzügig, aber nicht unbegrenzt. */
const EXPORT_LIMIT = 100_000;

export interface ExportBundle {
  format: 'reviewer-export';
  version: 1;
  exportedAt: string;
  entryCount: number;
  entries: EntryWithMedia[];
}

export async function buildJsonExport(db: DbClient): Promise<string> {
  const entries = await listDiary(db, { limit: EXPORT_LIMIT });
  const bundle: ExportBundle = {
    format: 'reviewer-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    entryCount: entries.length,
    entries,
  };
  return JSON.stringify(bundle, null, 2);
}

/** Maskiert ein Feld für CSV: Anführungszeichen verdoppeln, Feld einpacken. */
function csvField(value: string | number | null | boolean): string {
  if (value === null) return '';
  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function buildCsvExport(db: DbClient): Promise<string> {
  const entries = await listDiary(db, { limit: EXPORT_LIMIT });

  const header = [
    'Titel',
    'Jahr',
    'Typ',
    'TMDB-ID',
    'Ebene',
    'Staffel',
    'Episode',
    'Bewertung',
    'Review',
    'Spoiler',
    'Gesehen am',
    'Rewatch',
    'Status',
    'Abbruchgrund',
    'Tags',
    'Angelegt am',
  ].join(',');

  const rows = entries.map((item) =>
    [
      csvField(item.title),
      csvField(item.year),
      csvField(item.entry.mediaType === 'movie' ? 'Film' : 'Serie'),
      csvField(item.entry.tmdbId),
      csvField(item.entry.scope),
      csvField(item.entry.seasonNumber),
      csvField(item.entry.episodeNumber),
      csvField(item.entry.rating),
      csvField(item.entry.reviewText),
      csvField(item.entry.hasSpoilers ? 'ja' : 'nein'),
      csvField(item.entry.watchedAt),
      csvField(item.entry.isRewatch ? 'ja' : 'nein'),
      csvField(item.entry.status),
      csvField(item.entry.droppedReason),
      csvField(item.entry.tags.join('; ')),
      csvField(item.entry.createdAt),
    ].join(',')
  );

  return [header, ...rows].join('\n');
}

/**
 * Löscht alle Nutzerdaten. Der Metadaten-Cache fliegt mit raus — er ist
 * jederzeit von TMDB nachladbar und würde sonst als Rest zurückbleiben.
 * Die Settings bleiben, damit Region und Theme erhalten bleiben.
 */
export async function deleteAllUserData(db: DbClient): Promise<void> {
  await db.execAsync('BEGIN;');
  try {
    await db.execAsync('DELETE FROM entries; DELETE FROM watchlist; DELETE FROM media_cache;');
    await db.execAsync('COMMIT;');
  } catch (error) {
    await db.execAsync('ROLLBACK;');
    throw error;
  }
}

/** Wie viele Einträge und Watchlist-Titel gerade gespeichert sind. */
export async function countStoredData(
  db: DbClient
): Promise<{ entries: number; watchlist: number }> {
  const [entryRow, watchlistRow] = await Promise.all([
    db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM entries', []),
    db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM watchlist', []),
  ]);
  return { entries: entryRow?.n ?? 0, watchlist: watchlistRow?.n ?? 0 };
}
