import type { MediaType, Rating, SearchHit } from '@/types/media';

/**
 * Regelbasierte Empfehlungen — kein ML.
 *
 * Kandidaten kommen aus TMDBs `/recommendations` der eigenen bestbewerteten
 * Titel. Bewertet wird nach drei Signalen: wie sehr der Ausgangstitel
 * gefallen hat, wie gut die Genres zum eigenen Geschmack passen, und wie der
 * Titel allgemein ankommt. Gesehenes und die Watchlist fliegen raus.
 *
 * Die Scoring-Funktion ist bewusst pur: sie kennt weder Datenbank noch
 * Netzwerk und ist damit vollständig testbar.
 */

/** Ein Kandidat, wie er aus den Empfehlungen eines eigenen Titels stammt. */
export interface Candidate extends SearchHit {
  genres: string[];
  /** Titel, aus dessen Empfehlungen dieser Kandidat stammt */
  sourceTitle: string;
  /** Wie der Nutzer den Ausgangstitel bewertet hat */
  sourceRating: Rating;
}

export interface Recommendation extends SearchHit {
  genres: string[];
  score: number;
  /** Menschlich lesbare Begründung, die in der UI unter dem Titel steht */
  reason: string;
  /** Alle eigenen Titel, die zu diesem Vorschlag geführt haben */
  sources: string[];
}

export interface ScoringContext {
  /** Bereits gesehene Titel, Schlüssel `${mediaType}-${tmdbId}` */
  seen: Set<string>;
  /** Titel auf der Watchlist, gleicher Schlüssel */
  watchlist: Set<string>;
  /**
   * Genre-Vorlieben: Genre-Name auf Anteil an den eigenen guten Bewertungen
   * (0–1). Wird aus `buildGenreAffinity` gebaut.
   */
  genreAffinity: Map<string, number>;
}

export function mediaKey(mediaType: MediaType, tmdbId: number): string {
  return `${mediaType}-${tmdbId}`;
}

/**
 * Baut das Genre-Profil aus den eigenen gut bewerteten Titeln.
 * Ein Genre, das in der Hälfte der Lieblingstitel vorkommt, bekommt 0,5.
 */
export function buildGenreAffinity(likedTitleGenres: string[][]): Map<string, number> {
  const affinity = new Map<string, number>();
  if (likedTitleGenres.length === 0) return affinity;

  const counts = new Map<string, number>();
  for (const genres of likedTitleGenres) {
    // Pro Titel zählt jedes Genre einmal, auch wenn es doppelt gelistet wäre
    for (const genre of new Set(genres)) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }
  for (const [genre, count] of counts) {
    affinity.set(genre, count / likedTitleGenres.length);
  }
  return affinity;
}

/** Wie stark der Ausgangstitel gefallen hat: 5 Sterne → 1, 2,5 Sterne → 0. */
function sourceWeight(rating: Rating): number {
  return (rating - 2.5) / 2.5;
}

function formatReason(sources: string[]): string {
  if (sources.length === 1) return `Weil dir ${sources[0]} gefallen hat`;
  if (sources.length === 2) return `Weil dir ${sources[0]} und ${sources[1]} gefallen haben`;
  return `Weil dir ${sources[0]}, ${sources[1]} und ${sources.length - 2} weitere gefallen haben`;
}

/**
 * Bewertet und sortiert Kandidaten. Gesehenes und Watchlist-Titel werden
 * entfernt, Mehrfachnennungen zu einem Vorschlag zusammengefasst.
 */
export function scoreRecommendations(
  candidates: Candidate[],
  context: ScoringContext,
  limit = 20
): Recommendation[] {
  const merged = new Map<
    string,
    { candidate: Candidate; sources: { title: string; rating: Rating }[] }
  >();

  for (const candidate of candidates) {
    const key = mediaKey(candidate.mediaType, candidate.tmdbId);
    // Was man schon gesehen hat oder ohnehin vorhat, ist kein Vorschlag
    if (context.seen.has(key) || context.watchlist.has(key)) continue;

    const existing = merged.get(key);
    if (existing) {
      if (!existing.sources.some((source) => source.title === candidate.sourceTitle)) {
        existing.sources.push({ title: candidate.sourceTitle, rating: candidate.sourceRating });
      }
    } else {
      merged.set(key, {
        candidate,
        sources: [{ title: candidate.sourceTitle, rating: candidate.sourceRating }],
      });
    }
  }

  const scored: Recommendation[] = [];

  for (const { candidate, sources } of merged.values()) {
    // Der stärkste Ausgangstitel bestimmt den Grundwert
    const bestSource = sources.reduce((best, source) =>
      source.rating > best.rating ? source : best
    );
    const affinityScore = sourceWeight(bestSource.rating) * 2;

    // Taucht ein Titel in den Empfehlungen mehrerer Lieblingstitel auf,
    // ist das ein starkes Signal — aber kein unbegrenztes.
    const overlapBonus = Math.min(sources.length - 1, 3) * 0.4;

    const genreScore =
      candidate.genres.length === 0
        ? 0
        : candidate.genres.reduce(
            (sum, genre) => sum + (context.genreAffinity.get(genre) ?? 0),
            0
          ) / candidate.genres.length;

    const popularityScore = ((candidate.tmdbScore ?? 0) / 10) * 0.5;

    const score =
      Math.round((affinityScore + overlapBonus + genreScore + popularityScore) * 1000) / 1000;

    // Begründung nennt die am besten bewerteten Ausgangstitel zuerst
    const sortedSources = [...sources]
      .sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title, 'de'))
      .map((source) => source.title);

    scored.push({
      mediaType: candidate.mediaType,
      tmdbId: candidate.tmdbId,
      title: candidate.title,
      year: candidate.year,
      posterPath: candidate.posterPath,
      overview: candidate.overview,
      tmdbScore: candidate.tmdbScore,
      genres: candidate.genres,
      score,
      reason: formatReason(sortedSources),
      sources: sortedSources,
    });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'de'))
    .slice(0, limit);
}
