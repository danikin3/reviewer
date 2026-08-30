/**
 * Zentrale TMDB-HTTP-Schicht: Auth, Retry, Rate-Limit-Handling.
 * Kein anderer Code spricht direkt mit fetch() gegen TMDB.
 */

const BASE_URL = 'https://api.themoviedb.org/3';

/** TMDB liefert deutsche Metadaten, wo vorhanden. */
export const LANGUAGE = 'de-DE';

export type TmdbErrorKind =
  /** Kein API-Key konfiguriert */
  | 'missing-key'
  /** Key wurde von TMDB abgelehnt */
  | 'unauthorized'
  /** Titel existiert nicht */
  | 'not-found'
  /** Rate-Limit trotz Retries */
  | 'rate-limited'
  /** Netzwerk nicht erreichbar */
  | 'network'
  /** Alles andere */
  | 'unknown';

export class TmdbError extends Error {
  readonly kind: TmdbErrorKind;

  constructor(kind: TmdbErrorKind, message: string) {
    super(message);
    this.name = 'TmdbError';
    this.kind = kind;
  }
}

/** Deutsche, für Nutzer lesbare Meldung zu einem Fehler. */
export function describeTmdbError(error: unknown): string {
  if (error instanceof TmdbError) {
    switch (error.kind) {
      case 'missing-key':
        return 'Kein TMDB-Schlüssel hinterlegt. Trage EXPO_PUBLIC_TMDB_API_KEY in die .env ein.';
      case 'unauthorized':
        return 'Der TMDB-Schlüssel wurde abgelehnt. Prüfe den Schlüssel in der .env.';
      case 'not-found':
        return 'Dieser Titel wurde bei TMDB nicht gefunden.';
      case 'rate-limited':
        return 'TMDB drosselt gerade die Anfragen. Versuch es in einem Moment noch einmal.';
      case 'network':
        return 'Keine Verbindung zu TMDB. Prüfe deine Internetverbindung.';
      default:
        return 'TMDB hat unerwartet geantwortet.';
    }
  }
  return 'Unbekannter Fehler beim Laden der Daten.';
}

export function getApiKey(): string | null {
  const key = process.env.EXPO_PUBLIC_TMDB_API_KEY;
  return key && key.length > 0 ? key : null;
}

export function hasApiKey(): boolean {
  return getApiKey() !== null;
}

const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Führt einen GET gegen TMDB aus. Wiederholt bei 429 (Rate-Limit) und
 * 5xx mit exponentiellem Backoff; respektiert dabei `Retry-After`.
 */
export async function tmdbGet<T>(
  path: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new TmdbError('missing-key', 'EXPO_PUBLIC_TMDB_API_KEY ist nicht gesetzt');
  }

  const query = new URLSearchParams({
    api_key: apiKey,
    language: LANGUAGE,
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  });
  const url = `${BASE_URL}${path}?${query.toString()}`;

  let lastError: TmdbError = new TmdbError('unknown', 'Keine Antwort von TMDB');

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await delay(BASE_BACKOFF_MS * 2 ** (attempt - 1));
    }

    let response: Response;
    try {
      response = await fetch(url);
    } catch {
      lastError = new TmdbError('network', 'TMDB nicht erreichbar');
      continue;
    }

    if (response.ok) {
      return (await response.json()) as T;
    }

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('Retry-After'));
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        await delay(Math.min(retryAfter, 10) * 1000);
      }
      lastError = new TmdbError('rate-limited', 'TMDB Rate-Limit erreicht');
      continue;
    }

    if (response.status === 401) {
      throw new TmdbError('unauthorized', 'TMDB-Schlüssel abgelehnt');
    }
    if (response.status === 404) {
      throw new TmdbError('not-found', 'Bei TMDB nicht gefunden');
    }
    if (response.status >= 500) {
      lastError = new TmdbError('unknown', `TMDB-Serverfehler ${response.status}`);
      continue;
    }

    throw new TmdbError('unknown', `TMDB antwortete mit ${response.status}`);
  }

  throw lastError;
}
