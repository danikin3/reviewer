import { getRecommendations } from '@/api/tmdb/tmdb';
import type { DbClient } from '@/data/db-client';
import {
  buildGenreAffinity,
  mediaKey,
  scoreRecommendations,
  type Candidate,
  type Recommendation,
} from '@/data/recommendations';
import type { MediaType, Rating } from '@/types/media';

/** Ab dieser Bewertung gilt ein Titel als "gefallen" und taugt als Ausgangspunkt. */
const LIKED_THRESHOLD = 3.5;
/** Aus so vielen eigenen Lieblingstiteln werden Kandidaten geholt. */
const SOURCE_LIMIT = 20;

interface LikedRow {
  media_type: MediaType;
  tmdb_id: number;
  rating: number;
  title: string | null;
  genres: string | null;
}

/**
 * Verbindet die lokale Bewertungshistorie mit TMDBs Empfehlungen.
 * Das eigentliche Scoring liegt in `recommendations.ts` und ist dort
 * ohne Netzwerk getestet — hier geht es nur ums Beschaffen.
 */
export async function buildRecommendations(db: DbClient): Promise<Recommendation[]> {
  // Bestbewertete eigene Titel als Ausgangspunkte, je Titel die beste Bewertung
  const liked = await db.getAllAsync<LikedRow>(
    `SELECT e.media_type, e.tmdb_id, MAX(e.rating) AS rating,
            m.title, m.genres
     FROM entries e
     LEFT JOIN media_cache m ON m.media_type = e.media_type AND m.tmdb_id = e.tmdb_id
     WHERE e.scope = 'title' AND e.rating >= ? AND e.status = 'watched'
     GROUP BY e.media_type, e.tmdb_id
     ORDER BY rating DESC, e.created_at DESC
     LIMIT ?`,
    [LIKED_THRESHOLD, SOURCE_LIMIT]
  );

  if (liked.length === 0) return [];

  // Alles Gesehene und die Watchlist ausschließen
  const [seenRows, watchlistRows] = await Promise.all([
    db.getAllAsync<{ media_type: MediaType; tmdb_id: number }>(
      "SELECT DISTINCT media_type, tmdb_id FROM entries WHERE scope = 'title'",
      []
    ),
    db.getAllAsync<{ media_type: MediaType; tmdb_id: number }>(
      'SELECT media_type, tmdb_id FROM watchlist',
      []
    ),
  ]);

  const seen = new Set(seenRows.map((row) => mediaKey(row.media_type, row.tmdb_id)));
  const watchlist = new Set(watchlistRows.map((row) => mediaKey(row.media_type, row.tmdb_id)));

  const genreAffinity = buildGenreAffinity(
    liked.map((row) => {
      try {
        return row.genres ? (JSON.parse(row.genres) as string[]) : [];
      } catch {
        return [];
      }
    })
  );

  // Genres der Kandidaten kennt TMDB in der Empfehlungsliste nicht; als
  // Näherung erben sie die des Ausgangstitels — sie sind sich per Definition
  // ähnlich, und das Genre-Signal soll nur gewichten, nicht entscheiden.
  const candidates: Candidate[] = [];

  const results = await Promise.allSettled(
    liked.map(async (row) => {
      const hits = await getRecommendations(row.media_type, row.tmdb_id);
      let sourceGenres: string[] = [];
      try {
        sourceGenres = row.genres ? (JSON.parse(row.genres) as string[]) : [];
      } catch {
        sourceGenres = [];
      }
      return hits.map(
        (hit): Candidate => ({
          ...hit,
          genres: sourceGenres,
          sourceTitle: row.title ?? 'einem deiner Titel',
          sourceRating: row.rating as Rating,
        })
      );
    })
  );

  // Einzelne fehlgeschlagene Anfragen dürfen die Empfehlungen nicht kippen
  for (const result of results) {
    if (result.status === 'fulfilled') candidates.push(...result.value);
  }

  return scoreRecommendations(candidates, { seen, watchlist, genreAffinity });
}

/** Reicht die Historie schon für Empfehlungen? */
export async function hasEnoughHistory(db: DbClient): Promise<boolean> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(DISTINCT tmdb_id) AS n FROM entries
     WHERE scope = 'title' AND rating >= ? AND status = 'watched'`,
    [LIKED_THRESHOLD]
  );
  return (row?.n ?? 0) > 0;
}

/** Für Tests und Aufrufer, die den Schwellwert kennen müssen. */
export const LIKED_RATING_THRESHOLD = LIKED_THRESHOLD;
