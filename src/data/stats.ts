import type { DbClient } from '@/data/db-client';
import type { MediaDetails, MediaType, Rating } from '@/types/media';

/**
 * Statistiken werden immer aus `entries` und `media_cache` berechnet,
 * nie redundant gespeichert. Die Aggregation passiert in TypeScript statt
 * in SQL, weil Genres, Regie und Cast als JSON im Cache liegen — und weil
 * die Datenmengen einer persönlichen App das mühelos hergeben.
 */

export interface Counted {
  name: string;
  count: number;
}

export interface Stats {
  /** Verschiedene Filme mit mindestens einer Sichtung */
  movieCount: number;
  /** Verschiedene Serien mit Aktivität (Gesamtbewertung oder abgehakte Folgen) */
  seriesCount: number;
  /** Abgehakte bzw. bewertete Episoden */
  episodeCount: number;
  watchTimeMinutes: number;
  /** Immer alle zehn Stufen 0,5–5,0, auch die mit Anzahl 0 */
  ratingDistribution: { rating: Rating; count: number }[];
  averageRating: number | null;
  topGenres: Counted[];
  topDirectors: Counted[];
  topActors: Counted[];
  /** Bewertungen je Jahr, neueste zuerst */
  perYear: { year: number; count: number }[];
  /** Bewertungen je Monat des gewählten Jahres, 1–12 */
  perMonth: { month: number; count: number }[];
  /** Abgebrochene Serien */
  droppedCount: number;
}

interface EntryRow {
  media_type: MediaType;
  tmdb_id: number;
  scope: 'title' | 'season' | 'episode';
  season_number: number | null;
  episode_number: number | null;
  rating: number | null;
  status: 'watched' | 'dropped';
  watched_at: string | null;
  created_at: string;
}

interface CacheRow {
  media_type: MediaType;
  tmdb_id: number;
  runtime_minutes: number | null;
  genres: string;
  payload: string;
}

const ALL_RATINGS: Rating[] = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

function topN(counts: Map<string, number>, n: number): Counted[] {
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    // Bei Gleichstand alphabetisch, damit die Reihenfolge stabil bleibt
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'de'))
    .slice(0, n);
}

function increment(counts: Map<string, number>, key: string, by = 1): void {
  counts.set(key, (counts.get(key) ?? 0) + by);
}

/** Jahr eines Eintrags: bevorzugt das Sehdatum, sonst der Anlagezeitpunkt. */
function yearOfEntry(entry: EntryRow): number | null {
  const source = entry.watched_at ?? entry.created_at;
  const year = Number(source.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function monthOfEntry(entry: EntryRow): number | null {
  const source = entry.watched_at ?? entry.created_at;
  const month = Number(source.slice(5, 7));
  return month >= 1 && month <= 12 ? month : null;
}

export async function computeStats(
  db: DbClient,
  options: { year?: number } = {}
): Promise<Stats> {
  const [entries, cacheRows] = await Promise.all([
    db.getAllAsync<EntryRow>(
      `SELECT media_type, tmdb_id, scope, season_number, episode_number,
              rating, status, watched_at, created_at
       FROM entries`,
      []
    ),
    db.getAllAsync<CacheRow>(
      'SELECT media_type, tmdb_id, runtime_minutes, genres, payload FROM media_cache',
      []
    ),
  ]);

  const cache = new Map<string, CacheRow>(
    cacheRows.map((row) => [`${row.media_type}-${row.tmdb_id}`, row])
  );

  // perYear zählt über alle Jahre, alles andere nur im gewählten Jahr
  const perYearCounts = new Map<number, number>();
  for (const entry of entries) {
    if (entry.rating === null) continue;
    const year = yearOfEntry(entry);
    if (year !== null) perYearCounts.set(year, (perYearCounts.get(year) ?? 0) + 1);
  }

  const inScope =
    options.year === undefined
      ? entries
      : entries.filter((entry) => yearOfEntry(entry) === options.year);

  const watchedMovies = new Set<number>();
  const activeSeries = new Set<number>();
  const watchedEpisodes = new Set<string>();
  const droppedSeries = new Set<number>();
  const ratings: number[] = [];
  const ratingCounts = new Map<Rating, number>(ALL_RATINGS.map((r) => [r, 0]));
  const perMonthCounts = new Map<number, number>();

  const genreCounts = new Map<string, number>();
  const directorCounts = new Map<string, number>();
  const actorCounts = new Map<string, number>();

  /** Titel, deren Genres/Cast schon gezählt wurden — pro Titel nur einmal. */
  const creditedTitles = new Set<string>();

  for (const entry of inScope) {
    const key = `${entry.media_type}-${entry.tmdb_id}`;

    if (entry.status === 'dropped') {
      if (entry.media_type === 'tv') droppedSeries.add(entry.tmdb_id);
      continue;
    }

    if (entry.media_type === 'movie') {
      watchedMovies.add(entry.tmdb_id);
    } else {
      activeSeries.add(entry.tmdb_id);
      if (entry.scope === 'episode' && entry.season_number !== null && entry.episode_number !== null) {
        watchedEpisodes.add(`${entry.tmdb_id}-${entry.season_number}-${entry.episode_number}`);
      }
    }

    if (entry.rating !== null) {
      ratings.push(entry.rating);
      const rounded = entry.rating as Rating;
      if (ratingCounts.has(rounded)) {
        ratingCounts.set(rounded, (ratingCounts.get(rounded) ?? 0) + 1);
      }
      const month = monthOfEntry(entry);
      if (month !== null) perMonthCounts.set(month, (perMonthCounts.get(month) ?? 0) + 1);
    }

    // Genres, Regie und Cast zählen pro Titel einmal — sonst würde eine
    // Serie, von der 60 Folgen abgehakt sind, jedes Genre 60-mal gewinnen.
    if (!creditedTitles.has(key)) {
      creditedTitles.add(key);
      const cached = cache.get(key);
      if (cached) {
        for (const genre of JSON.parse(cached.genres) as string[]) {
          increment(genreCounts, genre);
        }
        try {
          const payload = JSON.parse(cached.payload) as Partial<MediaDetails>;
          for (const director of payload.directors ?? []) increment(directorCounts, director);
          for (const member of (payload.cast ?? []).slice(0, 10)) {
            increment(actorCounts, member.name);
          }
        } catch {
          // Beschädigter Cache-Eintrag darf die Statistik nicht kippen
        }
      }
    }
  }

  // Sehdauer: Filme nach ihrer Laufzeit, Serien nach Episoden.
  let watchTimeMinutes = 0;

  for (const tmdbId of watchedMovies) {
    const cached = cache.get(`movie-${tmdbId}`);
    watchTimeMinutes += cached?.runtime_minutes ?? 0;
  }

  const episodesPerSeries = new Map<number, number>();
  for (const key of watchedEpisodes) {
    const tmdbId = Number(key.split('-')[0]);
    episodesPerSeries.set(tmdbId, (episodesPerSeries.get(tmdbId) ?? 0) + 1);
  }

  for (const tmdbId of activeSeries) {
    const cached = cache.get(`tv-${tmdbId}`);
    const perEpisode = cached?.runtime_minutes ?? 0;
    const checkedEpisodes = episodesPerSeries.get(tmdbId) ?? 0;

    let totalEpisodes = 0;
    if (cached) {
      try {
        const payload = JSON.parse(cached.payload) as Partial<MediaDetails>;
        totalEpisodes = payload.episodeCount ?? 0;
      } catch {
        totalEpisodes = 0;
      }
    }

    const ratedWhole = inScope.some(
      (entry) =>
        entry.media_type === 'tv' &&
        entry.tmdb_id === tmdbId &&
        entry.scope === 'title' &&
        entry.status === 'watched'
    );

    // Abgehakte Folgen schlagen jede Annahme: sie sind das, was der Nutzer
    // tatsächlich angegeben hat. Nur wenn gar keine abgehakt sind, zählt eine
    // Gesamtbewertung als "ganze Serie gesehen". So wird weder doppelt
    // gezählt noch Sehzeit erfunden, die nie angegeben wurde.
    const episodes = checkedEpisodes > 0 ? checkedEpisodes : ratedWhole ? totalEpisodes : 0;
    watchTimeMinutes += episodes * perEpisode;
  }

  const averageRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((sum, value) => sum + value, 0) / ratings.length) * 10) / 10
      : null;

  return {
    movieCount: watchedMovies.size,
    seriesCount: activeSeries.size,
    episodeCount: watchedEpisodes.size,
    watchTimeMinutes,
    ratingDistribution: ALL_RATINGS.map((rating) => ({
      rating,
      count: ratingCounts.get(rating) ?? 0,
    })),
    averageRating,
    topGenres: topN(genreCounts, 5),
    topDirectors: topN(directorCounts, 5),
    topActors: topN(actorCounts, 5),
    perYear: Array.from(perYearCounts.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => b.year - a.year),
    perMonth: Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      count: perMonthCounts.get(index + 1) ?? 0,
    })),
    droppedCount: droppedSeries.size,
  };
}

/** „3 Tage 4 Std." — Minuten sind ab dieser Größenordnung nicht mehr greifbar. */
export function formatWatchTime(minutes: number): string {
  if (minutes <= 0) return '0 Std.';
  const totalHours = Math.floor(minutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days === 0) {
    return hours === 0 ? `${minutes} Min.` : `${hours} Std.`;
  }
  return hours === 0 ? `${days} ${days === 1 ? 'Tag' : 'Tage'}` : `${days} ${days === 1 ? 'Tag' : 'Tage'} ${hours} Std.`;
}
