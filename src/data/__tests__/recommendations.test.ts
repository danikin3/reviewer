import { describe, expect, it } from 'vitest';

import {
  buildGenreAffinity,
  mediaKey,
  scoreRecommendations,
  type Candidate,
  type ScoringContext,
} from '@/data/recommendations';
import type { Rating } from '@/types/media';

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    mediaType: 'movie',
    tmdbId: 1,
    title: 'Vorschlag',
    year: 2020,
    posterPath: null,
    overview: null,
    tmdbScore: 7,
    genres: ['Action'],
    sourceTitle: 'Matrix',
    sourceRating: 5 as Rating,
    ...overrides,
  };
}

function context(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    seen: new Set(),
    watchlist: new Set(),
    genreAffinity: new Map(),
    ...overrides,
  };
}

describe('buildGenreAffinity', () => {
  it('gibt den Anteil an den eigenen Lieblingstiteln zurück', () => {
    const affinity = buildGenreAffinity([
      ['Action', 'Science-Fiction'],
      ['Action'],
      ['Drama'],
      ['Action', 'Drama'],
    ]);

    expect(affinity.get('Action')).toBe(0.75);
    expect(affinity.get('Drama')).toBe(0.5);
    expect(affinity.get('Science-Fiction')).toBe(0.25);
  });

  it('zählt ein doppelt gelistetes Genre pro Titel nur einmal', () => {
    const affinity = buildGenreAffinity([['Action', 'Action']]);
    expect(affinity.get('Action')).toBe(1);
  });

  it('kommt mit leerer Historie klar', () => {
    expect(buildGenreAffinity([]).size).toBe(0);
  });
});

describe('scoreRecommendations', () => {
  it('schließt bereits Gesehenes aus', () => {
    const result = scoreRecommendations(
      [candidate({ tmdbId: 42 })],
      context({ seen: new Set([mediaKey('movie', 42)]) })
    );
    expect(result).toHaveLength(0);
  });

  it('schließt Titel auf der Watchlist aus', () => {
    const result = scoreRecommendations(
      [candidate({ tmdbId: 42 })],
      context({ watchlist: new Set([mediaKey('movie', 42)]) })
    );
    expect(result).toHaveLength(0);
  });

  it('unterscheidet Film und Serie mit gleicher TMDB-ID', () => {
    const result = scoreRecommendations(
      [candidate({ mediaType: 'tv', tmdbId: 42 })],
      context({ seen: new Set([mediaKey('movie', 42)]) })
    );
    // Der Film 42 ist gesehen, die Serie 42 ist ein anderer Titel
    expect(result).toHaveLength(1);
  });

  it('bevorzugt Vorschläge aus höher bewerteten Titeln', () => {
    const result = scoreRecommendations(
      [
        candidate({ tmdbId: 1, title: 'Aus Top-Film', sourceRating: 5 as Rating }),
        candidate({ tmdbId: 2, title: 'Aus Mittelmass', sourceRating: 3 as Rating }),
      ],
      context()
    );

    expect(result[0].title).toBe('Aus Top-Film');
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it('belohnt Genres, die dem eigenen Geschmack entsprechen', () => {
    const affinity = new Map([['Horror', 0.9]]);
    const result = scoreRecommendations(
      [
        candidate({ tmdbId: 1, title: 'Horrorfilm', genres: ['Horror'] }),
        candidate({ tmdbId: 2, title: 'Doku', genres: ['Dokumentarfilm'] }),
      ],
      context({ genreAffinity: affinity })
    );

    expect(result[0].title).toBe('Horrorfilm');
  });

  it('fasst denselben Titel aus mehreren Quellen zusammen', () => {
    const result = scoreRecommendations(
      [
        candidate({ tmdbId: 7, sourceTitle: 'Matrix', sourceRating: 5 as Rating }),
        candidate({ tmdbId: 7, sourceTitle: 'Inception', sourceRating: 4.5 as Rating }),
      ],
      context()
    );

    expect(result).toHaveLength(1);
    expect(result[0].sources).toEqual(['Matrix', 'Inception']);
  });

  it('bewertet einen Mehrfach-Treffer höher als einen Einzeltreffer', () => {
    const einzeln = scoreRecommendations([candidate({ tmdbId: 1 })], context())[0];
    const mehrfach = scoreRecommendations(
      [
        candidate({ tmdbId: 2, sourceTitle: 'Matrix' }),
        candidate({ tmdbId: 2, sourceTitle: 'Inception' }),
      ],
      context()
    )[0];

    expect(mehrfach.score).toBeGreaterThan(einzeln.score);
  });

  it('zählt dieselbe Quelle nicht doppelt', () => {
    const result = scoreRecommendations(
      [
        candidate({ tmdbId: 7, sourceTitle: 'Matrix' }),
        candidate({ tmdbId: 7, sourceTitle: 'Matrix' }),
      ],
      context()
    );
    expect(result[0].sources).toEqual(['Matrix']);
  });

  describe('Begründungen', () => {
    it('nennt bei einer Quelle den Titel', () => {
      const result = scoreRecommendations([candidate({ sourceTitle: 'Matrix' })], context());
      expect(result[0].reason).toBe('Weil dir Matrix gefallen hat');
    });

    it('nennt bei zwei Quellen beide', () => {
      const result = scoreRecommendations(
        [
          candidate({ tmdbId: 7, sourceTitle: 'Matrix', sourceRating: 5 as Rating }),
          candidate({ tmdbId: 7, sourceTitle: 'Inception', sourceRating: 4 as Rating }),
        ],
        context()
      );
      expect(result[0].reason).toBe('Weil dir Matrix und Inception gefallen haben');
    });

    it('fasst ab drei Quellen zusammen', () => {
      const result = scoreRecommendations(
        [
          candidate({ tmdbId: 7, sourceTitle: 'Matrix', sourceRating: 5 as Rating }),
          candidate({ tmdbId: 7, sourceTitle: 'Inception', sourceRating: 4.5 as Rating }),
          candidate({ tmdbId: 7, sourceTitle: 'Interstellar', sourceRating: 4 as Rating }),
          candidate({ tmdbId: 7, sourceTitle: 'Tenet', sourceRating: 4 as Rating }),
        ],
        context()
      );
      expect(result[0].reason).toBe('Weil dir Matrix, Inception und 2 weitere gefallen haben');
    });
  });

  it('respektiert das Limit', () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      candidate({ tmdbId: i, title: `Titel ${i}` })
    );
    expect(scoreRecommendations(many, context(), 5)).toHaveLength(5);
  });

  it('sortiert bei Gleichstand alphabetisch, damit die Reihenfolge stabil ist', () => {
    const result = scoreRecommendations(
      [
        candidate({ tmdbId: 1, title: 'Zebra' }),
        candidate({ tmdbId: 2, title: 'Anton' }),
      ],
      context()
    );
    expect(result.map((r) => r.title)).toEqual(['Anton', 'Zebra']);
  });

  it('kommt mit Kandidaten ohne Genres und ohne TMDB-Score klar', () => {
    const result = scoreRecommendations(
      [candidate({ genres: [], tmdbScore: null })],
      context()
    );
    expect(result).toHaveLength(1);
    expect(Number.isFinite(result[0].score)).toBe(true);
  });
});
