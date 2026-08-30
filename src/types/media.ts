/** Gemeinsame Domänen-Typen. Filme und Serien sind überall gleichwertig. */

export type MediaType = 'movie' | 'tv';

/** Bewertungsebene: Serie/Film gesamt, einzelne Staffel oder einzelne Episode. */
export type EntryScope = 'title' | 'season' | 'episode';

export type EntryStatus = 'watched' | 'dropped';

/** Rating in Halbschritten, 0.5–5.0 */
export type Rating = 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5;

export interface Entry {
  id: number;
  mediaType: MediaType;
  tmdbId: number;
  scope: EntryScope;
  seasonNumber: number | null;
  episodeNumber: number | null;
  rating: Rating | null;
  reviewText: string | null;
  hasSpoilers: boolean;
  /** ISO-Datum (YYYY-MM-DD), an dem der Titel gesehen wurde */
  watchedAt: string | null;
  isRewatch: boolean;
  status: EntryStatus;
  droppedReason: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type NewEntry = Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>;

export interface WatchlistItem {
  mediaType: MediaType;
  tmdbId: number;
  createdAt: string;
}

/** Gecachte TMDB-Metadaten. `payload` ist die volle API-Response. */
export interface CachedMedia {
  mediaType: MediaType;
  tmdbId: number;
  payload: unknown;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  runtimeMinutes: number | null;
  genres: string[];
  fetchedAt: string;
}
