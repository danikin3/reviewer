import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TmdbError, describeTmdbError, tmdbGet } from '@/api/tmdb/client';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

describe('tmdbGet', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.EXPO_PUBLIC_TMDB_API_KEY = 'test-key';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete process.env.EXPO_PUBLIC_TMDB_API_KEY;
  });

  /** Läuft die Promise-Kette inklusive aller Backoff-Timer durch. */
  async function runWithTimers<T>(promise: Promise<T>): Promise<T> {
    const settled = promise.then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error })
    );
    await vi.runAllTimersAsync();
    const result = await settled;
    if (result.ok) return result.value;
    throw result.error;
  }

  it('wirft missing-key, wenn kein Schlüssel gesetzt ist', async () => {
    delete process.env.EXPO_PUBLIC_TMDB_API_KEY;
    await expect(tmdbGet('/movie/603')).rejects.toMatchObject({ kind: 'missing-key' });
  });

  it('hängt api_key und language an die URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 603 }));
    vi.stubGlobal('fetch', fetchMock);

    await runWithTimers(tmdbGet('/movie/603'));

    const url = new URL(fetchMock.mock.calls[0][0] as string);
    expect(url.searchParams.get('api_key')).toBe('test-key');
    expect(url.searchParams.get('language')).toBe('de-DE');
  });

  it('wiederholt bei 429 und liefert dann das Ergebnis', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 429, { 'Retry-After': '1' }))
      .mockResolvedValueOnce(jsonResponse({ id: 603 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await runWithTimers(tmdbGet<{ id: number }>('/movie/603'));

    expect(result.id).toBe(603);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gibt nach drei Rate-Limit-Antworten auf', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, 429));
    vi.stubGlobal('fetch', fetchMock);

    await expect(runWithTimers(tmdbGet('/movie/603'))).rejects.toMatchObject({
      kind: 'rate-limited',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('wiederholt bei Serverfehlern', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({ id: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(runWithTimers(tmdbGet('/movie/1'))).resolves.toEqual({ id: 1 });
  });

  it('wiederholt bei Netzwerkfehlern und meldet dann network', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(runWithTimers(tmdbGet('/movie/1'))).rejects.toMatchObject({ kind: 'network' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('wiederholt NICHT bei 401 und 404', async () => {
    const unauthorized = vi.fn().mockResolvedValue(jsonResponse({}, 401));
    vi.stubGlobal('fetch', unauthorized);
    await expect(runWithTimers(tmdbGet('/movie/1'))).rejects.toMatchObject({
      kind: 'unauthorized',
    });
    expect(unauthorized).toHaveBeenCalledTimes(1);

    const notFound = vi.fn().mockResolvedValue(jsonResponse({}, 404));
    vi.stubGlobal('fetch', notFound);
    await expect(runWithTimers(tmdbGet('/movie/1'))).rejects.toMatchObject({ kind: 'not-found' });
    expect(notFound).toHaveBeenCalledTimes(1);
  });
});

describe('describeTmdbError', () => {
  it('liefert deutsche Meldungen je Fehlerart', () => {
    expect(describeTmdbError(new TmdbError('missing-key', ''))).toContain('TMDB-Schlüssel');
    expect(describeTmdbError(new TmdbError('network', ''))).toContain('Internetverbindung');
    expect(describeTmdbError(new Error('irgendwas'))).toContain('Unbekannter Fehler');
  });
});
