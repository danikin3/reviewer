import { tmdbGet } from '@/api/tmdb/client';
import type {
  TmdbEpisode,
  TmdbMovieDetails,
  TmdbPaginated,
  TmdbProvider,
  TmdbSearchResult,
  TmdbSeasonDetails,
  TmdbSeasonSummary,
  TmdbTvDetails,
  TmdbWatchProviders,
} from '@/api/tmdb/raw-types';
import type {
  CastMember,
  EpisodeSummary,
  MediaDetails,
  SearchHit,
  SeasonSummary,
  WatchAvailability,
  WatchProvider,
} from '@/types/media';

/** TMDB-Pfadsegment: nur Filme und Serien haben diese Endpunkte. */
type MediaTypeParam = 'movie' | 'tv';

function yearOf(date: string | null | undefined): number | null {
  if (!date) return null;
  const year = Number(date.slice(0, 4));
  return Number.isFinite(year) && year > 1800 ? year : null;
}

function scoreOf(vote: number | undefined): number | null {
  return typeof vote === 'number' && vote > 0 ? Math.round(vote * 10) / 10 : null;
}

function mapCast(cast: { id: number; name: string; character?: string; profile_path: string | null }[] = []): CastMember[] {
  return cast.slice(0, 20).map((member) => ({
    tmdbId: member.id,
    name: member.name,
    character: member.character ?? null,
    profilePath: member.profile_path,
  }));
}

function trailerKeyOf(videos: { key: string; site: string; type: string }[] = []): string | null {
  const trailer =
    videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ??
    videos.find((v) => v.site === 'YouTube' && v.type === 'Teaser');
  return trailer?.key ?? null;
}

function mapSeason(season: TmdbSeasonSummary): SeasonSummary {
  return {
    seasonNumber: season.season_number,
    name: season.name,
    episodeCount: season.episode_count,
    airDate: season.air_date,
    posterPath: season.poster_path,
  };
}

function mapEpisode(episode: TmdbEpisode): EpisodeSummary {
  return {
    seasonNumber: episode.season_number,
    episodeNumber: episode.episode_number,
    name: episode.name,
    overview: episode.overview ?? null,
    airDate: episode.air_date,
    runtimeMinutes: episode.runtime,
    stillPath: episode.still_path,
  };
}

/**
 * Bringt TMDB-Ergebnislisten in die einheitliche Trefferform.
 * Personen fliegen raus — die App bewertet keine Menschen.
 */
function mapSearchResults(results: TmdbSearchResult[]): SearchHit[] {
  const hits: SearchHit[] = [];
  for (const result of results) {
    if (result.media_type === 'movie') {
      hits.push({
        mediaType: 'movie',
        tmdbId: result.id,
        title: result.title,
        year: yearOf(result.release_date),
        posterPath: result.poster_path,
        overview: result.overview ?? null,
        tmdbScore: scoreOf(result.vote_average),
      });
    } else if (result.media_type === 'tv') {
      hits.push({
        mediaType: 'tv',
        tmdbId: result.id,
        title: result.name,
        year: yearOf(result.first_air_date),
        posterPath: result.poster_path,
        overview: result.overview ?? null,
        tmdbScore: scoreOf(result.vote_average),
      });
    }
  }
  return hits;
}

/** Suche über Filme UND Serien in einem gemeinsamen Ergebnis-Feed. */
export async function searchMulti(query: string, page = 1): Promise<SearchHit[]> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];

  const data = await tmdbGet<TmdbPaginated<TmdbSearchResult>>('/search/multi', {
    query: trimmed,
    page,
    include_adult: 'false',
  });
  return mapSearchResults(data.results);
}

export async function getMovieDetails(tmdbId: number): Promise<MediaDetails> {
  const movie = await tmdbGet<TmdbMovieDetails>(`/movie/${tmdbId}`, {
    append_to_response: 'credits,videos',
  });

  return {
    mediaType: 'movie',
    tmdbId: movie.id,
    title: movie.title,
    year: yearOf(movie.release_date),
    overview: movie.overview,
    posterPath: movie.poster_path,
    backdropPath: movie.backdrop_path,
    genres: movie.genres.map((genre) => genre.name),
    tmdbScore: scoreOf(movie.vote_average),
    cast: mapCast(movie.credits?.cast),
    trailerKey: trailerKeyOf(movie.videos?.results),
    runtimeMinutes: movie.runtime,
    seasonCount: null,
    episodeCount: null,
    seasons: [],
    directors:
      movie.credits?.crew?.filter((person) => person.job === 'Director').map((p) => p.name) ?? [],
  };
}

export async function getTvDetails(tmdbId: number): Promise<MediaDetails> {
  const tv = await tmdbGet<TmdbTvDetails>(`/tv/${tmdbId}`, {
    append_to_response: 'credits,videos',
  });

  const runtimes = tv.episode_run_time ?? [];
  const averageRuntime =
    runtimes.length > 0
      ? Math.round(runtimes.reduce((sum, value) => sum + value, 0) / runtimes.length)
      : null;

  return {
    mediaType: 'tv',
    tmdbId: tv.id,
    title: tv.name,
    year: yearOf(tv.first_air_date),
    overview: tv.overview,
    posterPath: tv.poster_path,
    backdropPath: tv.backdrop_path,
    genres: tv.genres.map((genre) => genre.name),
    tmdbScore: scoreOf(tv.vote_average),
    cast: mapCast(tv.credits?.cast),
    trailerKey: trailerKeyOf(tv.videos?.results),
    runtimeMinutes: averageRuntime,
    seasonCount: tv.number_of_seasons,
    episodeCount: tv.number_of_episodes,
    // Staffel 0 ist bei TMDB "Specials" — nicht Teil der regulären Serie
    seasons: (tv.seasons ?? []).filter((s) => s.season_number > 0).map(mapSeason),
    directors: tv.credits?.crew?.filter((p) => p.job === 'Creator').map((p) => p.name) ?? [],
  };
}

export function getDetails(mediaType: 'movie' | 'tv', tmdbId: number): Promise<MediaDetails> {
  return mediaType === 'movie' ? getMovieDetails(tmdbId) : getTvDetails(tmdbId);
}

export async function getSeasonEpisodes(
  tmdbId: number,
  seasonNumber: number
): Promise<EpisodeSummary[]> {
  const season = await tmdbGet<TmdbSeasonDetails>(`/tv/${tmdbId}/season/${seasonNumber}`);
  return season.episodes.map(mapEpisode);
}

/** Was diese Woche läuft — Filme und Serien gemeinsam. */
export async function getTrending(): Promise<SearchHit[]> {
  const data = await tmdbGet<TmdbPaginated<TmdbSearchResult>>('/trending/all/week');
  return mapSearchResults(data.results);
}

/**
 * TMDB-Empfehlungen zu einem Titel. Die Genre-IDs der Ergebnisse werden
 * nicht mitgeliefert, deshalb liefert diese Funktion nur die Basisdaten —
 * die Genres kommen aus dem Cache des Ausgangstitels bzw. beim Öffnen.
 */
export async function getRecommendations(
  mediaType: MediaTypeParam,
  tmdbId: number
): Promise<SearchHit[]> {
  const data = await tmdbGet<TmdbPaginated<TmdbSearchResult>>(
    `/${mediaType}/${tmdbId}/recommendations`
  );
  // Die Endpunkte liefern kein media_type-Feld — es ist implizit der des Titels
  return mapSearchResults(
    data.results.map((result) => ({ ...result, media_type: mediaType }) as TmdbSearchResult)
  );
}

/**
 * Streaming-Verfügbarkeit für eine Region. TMDB bezieht diese Daten von
 * JustWatch und liefert **keine Preise und keine Deeplinks** in die
 * Anbieter-Apps — nur den Link auf die TMDB-Watch-Seite. Die Nutzung
 * verlangt sichtbare JustWatch-Attribution.
 */
export async function getWatchProviders(
  mediaType: MediaTypeParam,
  tmdbId: number,
  region: string
): Promise<WatchAvailability | null> {
  const data = await tmdbGet<TmdbWatchProviders>(`/${mediaType}/${tmdbId}/watch/providers`);
  const forRegion = data.results[region];
  if (!forRegion) return null;

  const map = (providers: TmdbProvider[] | undefined): WatchProvider[] =>
    (providers ?? []).map((provider) => ({
      providerId: provider.provider_id,
      name: provider.provider_name,
      logoPath: provider.logo_path,
    }));

  const availability: WatchAvailability = {
    region,
    link: forRegion.link ?? null,
    // "free" und "ads" gehören inhaltlich zum Abo-Bereich: man zahlt nichts extra
    flatrate: [...map(forRegion.flatrate), ...map(forRegion.free), ...map(forRegion.ads)],
    rent: map(forRegion.rent),
    buy: map(forRegion.buy),
  };

  const isEmpty =
    availability.flatrate.length === 0 &&
    availability.rent.length === 0 &&
    availability.buy.length === 0;

  return isEmpty ? null : availability;
}
