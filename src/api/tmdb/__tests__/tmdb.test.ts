import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getSeasonEpisodes, getTvDetails, getMovieDetails, searchMulti } from '@/api/tmdb/tmdb';

function stubFetchJson(body: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('TMDB-Normalisierung', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_TMDB_API_KEY = 'test-key';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.EXPO_PUBLIC_TMDB_API_KEY;
  });

  describe('searchMulti', () => {
    it('bringt Filme und Serien in dieselbe Form und filtert Personen', async () => {
      stubFetchJson({
        page: 1,
        total_pages: 1,
        total_results: 3,
        results: [
          {
            media_type: 'movie',
            id: 603,
            title: 'Matrix',
            release_date: '1999-03-31',
            poster_path: '/m.jpg',
            overview: 'Neo',
            vote_average: 8.216,
          },
          {
            media_type: 'tv',
            id: 1396,
            name: 'Breaking Bad',
            first_air_date: '2008-01-20',
            poster_path: '/bb.jpg',
            overview: 'Walt',
            vote_average: 8.9,
          },
          { media_type: 'person', id: 1, name: 'Keanu Reeves' },
        ],
      });

      const hits = await searchMulti('matrix');

      expect(hits).toHaveLength(2);
      expect(hits[0]).toEqual({
        mediaType: 'movie',
        tmdbId: 603,
        title: 'Matrix',
        year: 1999,
        posterPath: '/m.jpg',
        overview: 'Neo',
        tmdbScore: 8.2,
      });
      expect(hits[1]).toMatchObject({ mediaType: 'tv', title: 'Breaking Bad', year: 2008 });
      // Beide Typen haben exakt dieselben Felder — das ist der USP.
      expect(Object.keys(hits[0])).toEqual(Object.keys(hits[1]));
    });

    it('fragt bei leerer Eingabe gar nicht erst an', async () => {
      const fetchMock = stubFetchJson({ results: [] });
      expect(await searchMulti('   ')).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('verträgt fehlende Felder', async () => {
      stubFetchJson({
        results: [{ media_type: 'movie', id: 1, title: 'Ohne alles', poster_path: null }],
      });
      const [hit] = await searchMulti('x');
      expect(hit.year).toBeNull();
      expect(hit.tmdbScore).toBeNull();
      expect(hit.overview).toBeNull();
    });
  });

  describe('getMovieDetails', () => {
    it('normalisiert Genres, Cast, Regie und Trailer', async () => {
      stubFetchJson({
        id: 603,
        title: 'Matrix',
        overview: 'Neo',
        poster_path: '/m.jpg',
        backdrop_path: '/b.jpg',
        release_date: '1999-03-31',
        runtime: 136,
        vote_average: 8.2,
        genres: [{ id: 28, name: 'Action' }],
        credits: {
          cast: [{ id: 6384, name: 'Keanu Reeves', character: 'Neo', profile_path: '/k.jpg' }],
          crew: [
            { id: 9339, name: 'Lana Wachowski', job: 'Director' },
            { id: 1, name: 'Egal', job: 'Editor' },
          ],
        },
        videos: { results: [{ key: 'abc', site: 'YouTube', type: 'Trailer' }] },
      });

      const details = await getMovieDetails(603);

      expect(details.genres).toEqual(['Action']);
      expect(details.directors).toEqual(['Lana Wachowski']);
      expect(details.trailerKey).toBe('abc');
      expect(details.cast[0]).toEqual({
        tmdbId: 6384,
        name: 'Keanu Reeves',
        character: 'Neo',
        profilePath: '/k.jpg',
      });
      // Serienfelder bleiben leer, existieren aber — gleiche Struktur für beide Typen
      expect(details.seasonCount).toBeNull();
      expect(details.seasons).toEqual([]);
    });
  });

  describe('getTvDetails', () => {
    it('mittelt die Episodenlaufzeit und filtert Specials heraus', async () => {
      stubFetchJson({
        id: 1396,
        name: 'Breaking Bad',
        overview: 'Walt',
        poster_path: '/bb.jpg',
        backdrop_path: null,
        first_air_date: '2008-01-20',
        episode_run_time: [45, 47],
        number_of_seasons: 5,
        number_of_episodes: 62,
        vote_average: 8.9,
        genres: [{ id: 18, name: 'Drama' }],
        seasons: [
          { id: 1, season_number: 0, name: 'Specials', episode_count: 5, air_date: null, poster_path: null },
          { id: 2, season_number: 1, name: 'Staffel 1', episode_count: 7, air_date: '2008-01-20', poster_path: '/s1.jpg' },
        ],
        credits: { crew: [{ id: 66633, name: 'Vince Gilligan', job: 'Creator' }] },
      });

      const details = await getTvDetails(1396);

      expect(details.runtimeMinutes).toBe(46);
      expect(details.seasonCount).toBe(5);
      expect(details.episodeCount).toBe(62);
      expect(details.seasons).toHaveLength(1);
      expect(details.seasons[0].seasonNumber).toBe(1);
      expect(details.directors).toEqual(['Vince Gilligan']);
    });

    it('setzt die Laufzeit auf null, wenn TMDB keine kennt', async () => {
      stubFetchJson({
        id: 1,
        name: 'X',
        overview: null,
        poster_path: null,
        backdrop_path: null,
        number_of_seasons: 1,
        number_of_episodes: 1,
        vote_average: 0,
        genres: [],
      });
      const details = await getTvDetails(1);
      expect(details.runtimeMinutes).toBeNull();
      expect(details.tmdbScore).toBeNull();
    });
  });

  describe('getSeasonEpisodes', () => {
    it('normalisiert die Episodenliste', async () => {
      stubFetchJson({
        id: 1,
        season_number: 5,
        name: 'Staffel 5',
        air_date: '2012-07-15',
        poster_path: null,
        episodes: [
          {
            id: 62161,
            episode_number: 14,
            season_number: 5,
            name: 'Ozymandias',
            overview: 'Beste Folge',
            air_date: '2013-09-15',
            runtime: 48,
            still_path: '/o.jpg',
          },
        ],
      });

      const episodes = await getSeasonEpisodes(1396, 5);

      expect(episodes).toHaveLength(1);
      expect(episodes[0]).toEqual({
        seasonNumber: 5,
        episodeNumber: 14,
        name: 'Ozymandias',
        overview: 'Beste Folge',
        airDate: '2013-09-15',
        runtimeMinutes: 48,
        stillPath: '/o.jpg',
      });
    });
  });
});
