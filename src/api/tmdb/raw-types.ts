/**
 * Rohe TMDB-API-Antworten. Diese Typen bilden ab, was die API liefert —
 * für die App werden sie in `@/types/media` normalisiert, damit Filme und
 * Serien überall dieselbe Form haben.
 */

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbSearchMovie {
  media_type: 'movie';
  id: number;
  title: string;
  original_title?: string;
  overview?: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  vote_average?: number;
}

export interface TmdbSearchTv {
  media_type: 'tv';
  id: number;
  name: string;
  original_name?: string;
  overview?: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  first_air_date?: string;
  vote_average?: number;
}

export interface TmdbSearchPerson {
  media_type: 'person';
  id: number;
  name: string;
}

export type TmdbSearchResult = TmdbSearchMovie | TmdbSearchTv | TmdbSearchPerson;

export interface TmdbPaginated<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

export interface TmdbCastMember {
  id: number;
  name: string;
  character?: string;
  profile_path: string | null;
  order?: number;
}

export interface TmdbCrewMember {
  id: number;
  name: string;
  job?: string;
  department?: string;
}

export interface TmdbVideo {
  key: string;
  site: string;
  type: string;
  official?: boolean;
}

export interface TmdbMovieDetails {
  id: number;
  title: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  runtime: number | null;
  genres: TmdbGenre[];
  vote_average: number;
  credits?: { cast?: TmdbCastMember[]; crew?: TmdbCrewMember[] };
  videos?: { results?: TmdbVideo[] };
}

export interface TmdbSeasonSummary {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  air_date: string | null;
  poster_path: string | null;
  overview?: string;
}

export interface TmdbTvDetails {
  id: number;
  name: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date?: string;
  episode_run_time?: number[];
  number_of_seasons: number;
  number_of_episodes: number;
  genres: TmdbGenre[];
  vote_average: number;
  seasons?: TmdbSeasonSummary[];
  credits?: { cast?: TmdbCastMember[]; crew?: TmdbCrewMember[] };
  videos?: { results?: TmdbVideo[] };
}

export interface TmdbEpisode {
  id: number;
  episode_number: number;
  season_number: number;
  name: string;
  overview?: string;
  air_date: string | null;
  runtime: number | null;
  still_path: string | null;
  vote_average?: number;
}

export interface TmdbSeasonDetails {
  id: number;
  season_number: number;
  name: string;
  overview?: string;
  air_date: string | null;
  poster_path: string | null;
  episodes: TmdbEpisode[];
}
