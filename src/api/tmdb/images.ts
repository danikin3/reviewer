const IMAGE_BASE = 'https://image.tmdb.org/t/p';

/**
 * Bildgrößen je Kontext. `original` wird bewusst nicht angeboten —
 * es gehört nie in Listen oder Feeds.
 */
export const PosterSize = {
  /** Listen, Grids, Suchergebnisse */
  list: 'w185',
  /** Detailseite */
  detail: 'w500',
} as const;

export type PosterSizeName = (typeof PosterSize)[keyof typeof PosterSize];

export function posterUrl(path: string | null, size: PosterSizeName): string | null {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

export function backdropUrl(path: string | null): string | null {
  return path ? `${IMAGE_BASE}/w780${path}` : null;
}

export function profileUrl(path: string | null): string | null {
  return path ? `${IMAGE_BASE}/w185${path}` : null;
}

export function stillUrl(path: string | null): string | null {
  return path ? `${IMAGE_BASE}/w300${path}` : null;
}
