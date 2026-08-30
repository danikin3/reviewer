import { searchMulti } from '@/api/tmdb/tmdb';
import type { DbClient } from '@/data/db-client';
import { saveRating } from '@/data/diary';
import { parseLetterboxdCsv, pickBestMatch, type LetterboxdRow } from '@/data/letterboxd';
import { getCachedMedia, upsertCachedMedia } from '@/data/media-cache';
import type { Rating } from '@/types/media';

export interface ImportProgress {
  processed: number;
  total: number;
  imported: number;
  skipped: number;
  currentTitle: string;
}

export interface ImportResult {
  total: number;
  imported: number;
  /** Zeilen, zu denen TMDB keinen passenden Film kannte */
  notFound: string[];
}

/** Pause zwischen Suchanfragen, damit TMDBs Rate-Limit nicht reißt. */
const REQUEST_DELAY_MS = 120;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Importiert eine Letterboxd-CSV.
 *
 * Jede Zeile braucht eine TMDB-Suche, deshalb läuft der Import bewusst
 * seriell mit kleiner Pause statt parallel — ein Rate-Limit mitten im
 * Import wäre schlimmer als ein paar Sekunden mehr. Der Fortschritt wird
 * gemeldet, damit die UI nicht einfach nur steht.
 */
export async function importLetterboxdCsv(
  db: DbClient,
  csvText: string,
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  const rows = parseLetterboxdCsv(csvText);
  const notFound: string[] = [];
  let imported = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    onProgress?.({
      processed: i,
      total: rows.length,
      imported,
      skipped: notFound.length,
      currentTitle: row.title,
    });

    try {
      const success = await importRow(db, row);
      if (success) {
        imported++;
      } else {
        notFound.push(`${row.title}${row.year !== null ? ` (${row.year})` : ''}`);
      }
    } catch {
      // Eine fehlgeschlagene Zeile darf den ganzen Import nicht beenden
      notFound.push(`${row.title}${row.year !== null ? ` (${row.year})` : ''}`);
    }

    if (i < rows.length - 1) await delay(REQUEST_DELAY_MS);
  }

  onProgress?.({
    processed: rows.length,
    total: rows.length,
    imported,
    skipped: notFound.length,
    currentTitle: '',
  });

  return { total: rows.length, imported, notFound };
}

async function importRow(db: DbClient, row: LetterboxdRow): Promise<boolean> {
  const query = row.year !== null ? `${row.title} ${row.year}` : row.title;
  const hits = await searchMulti(query);
  const match = pickBestMatch(row, hits.length > 0 ? hits : await searchMulti(row.title));
  if (!match) return false;

  // Genres und Laufzeit kennt die Suche nicht — für den Import reicht,
  // was da ist; beim Öffnen der Detailseite wird der Cache vervollständigt.
  const existing = await getCachedMedia(db, 'movie', match.tmdbId);
  if (!existing) {
    await upsertCachedMedia(db, {
      mediaType: 'movie',
      tmdbId: match.tmdbId,
      payload: match,
      title: match.title,
      posterPath: match.posterPath,
      releaseDate: match.year !== null ? `${match.year}-01-01` : null,
      runtimeMinutes: null,
      genres: [],
    });
  }

  await saveRating(
    db,
    {
      mediaType: 'movie',
      tmdbId: match.tmdbId,
      title: match.title,
      year: match.year,
      overview: match.overview,
      posterPath: match.posterPath,
      backdropPath: null,
      genres: existing?.genres ?? [],
      tmdbScore: match.tmdbScore,
      cast: [],
      trailerKey: null,
      runtimeMinutes: existing?.runtimeMinutes ?? null,
      seasonCount: null,
      episodeCount: null,
      seasons: [],
      directors: [],
    },
    {
      scope: 'title',
      seasonNumber: null,
      episodeNumber: null,
      rating: row.rating as Rating | null,
      reviewText: null,
      hasSpoilers: false,
      watchedAt: row.watchedAt,
      isRewatch: row.isRewatch,
      status: 'watched',
      droppedReason: null,
      tags: row.tags,
    }
  );

  return true;
}
