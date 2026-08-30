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

/**
 * Eintrag samt der gecachten Titel-Metadaten — was Tagebuch und Poster-Grid
 * brauchen, ohne dafür TMDB anzufragen.
 */
export interface EntryWithMedia {
  entry: Entry;
  title: string;
  posterPath: string | null;
  year: number | null;
}

export interface WatchlistItem {
  mediaType: MediaType;
  tmdbId: number;
  createdAt: string;
}

/**
 * Normalisiertes Suchergebnis. Film und Serie haben bewusst dieselbe Form —
 * der Unterschied steckt nur in `mediaType`, nirgends in der Struktur.
 */
export interface SearchHit {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  /** Erscheinungsjahr, falls TMDB eines kennt */
  year: number | null;
  posterPath: string | null;
  overview: string | null;
  tmdbScore: number | null;
}

export interface CastMember {
  tmdbId: number;
  name: string;
  character: string | null;
  profilePath: string | null;
}

export interface SeasonSummary {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate: string | null;
  posterPath: string | null;
}

export interface EpisodeSummary {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  overview: string | null;
  airDate: string | null;
  runtimeMinutes: number | null;
  stillPath: string | null;
}

/**
 * Normalisierte Detailansicht. Serien-spezifische Felder stehen gleichrangig
 * neben den Film-Feldern statt in einem Sonderzweig.
 */
export interface MediaDetails {
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  year: number | null;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  genres: string[];
  tmdbScore: number | null;
  cast: CastMember[];
  /** YouTube-Key des Trailers, falls vorhanden */
  trailerKey: string | null;
  /** Filme: Laufzeit. Serien: durchschnittliche Episodenlänge. */
  runtimeMinutes: number | null;
  /** Nur Serien */
  seasonCount: number | null;
  episodeCount: number | null;
  seasons: SeasonSummary[];
  /** Regie (Filme) bzw. Creator (Serien) */
  directors: string[];
}

export interface WatchProvider {
  providerId: number;
  name: string;
  logoPath: string | null;
}

/**
 * Streaming-Verfügbarkeit eines Titels in einer Region.
 * Bewusst ohne Preise: TMDB/JustWatch liefern keine, und erfundene wären
 * schlimmer als gar keine. `link` führt auf die TMDB-Watch-Seite.
 */
export interface WatchAvailability {
  region: string;
  link: string | null;
  /** Im Abo enthalten (inklusive kostenlos und werbefinanziert) */
  flatrate: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
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
