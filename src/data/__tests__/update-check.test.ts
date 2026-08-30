import { afterEach, describe, expect, it, vi } from 'vitest';

import { checkForUpdate, isNewerVersion } from '@/data/update-check';

describe('isNewerVersion', () => {
  it.each([
    ['0.2.0', '0.1.0', true],
    ['1.0.0', '0.9.9', true],
    ['0.1.1', '0.1.0', true],
    ['0.1.0', '0.1.0', false],
    ['0.1.0', '0.2.0', false],
    ['0.9.9', '1.0.0', false],
  ])('%s gegenüber %s ist neuer: %s', (candidate, current, expected) => {
    expect(isNewerVersion(candidate, current)).toBe(expected);
  });

  it('ignoriert ein führendes v', () => {
    expect(isNewerVersion('v0.2.0', '0.1.0')).toBe(true);
    expect(isNewerVersion('v0.1.0', 'v0.1.0')).toBe(false);
  });

  it('vergleicht 10 als größer denn 9 — nicht alphabetisch', () => {
    expect(isNewerVersion('0.10.0', '0.9.0')).toBe(true);
  });

  it('behandelt fehlende Stellen als Null', () => {
    expect(isNewerVersion('1.1', '1.0.0')).toBe(true);
    expect(isNewerVersion('1.0', '1.0.0')).toBe(false);
  });

  it('lässt Vorabkennzeichnungen außer Acht', () => {
    expect(isNewerVersion('0.2.0-beta.1', '0.1.0')).toBe(true);
  });

  it('stürzt bei Unsinn nicht ab', () => {
    expect(isNewerVersion('kaputt', '0.1.0')).toBe(false);
  });
});

describe('checkForUpdate', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(body: unknown, status = 200): void {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }))
    );
  }

  it('meldet ein neueres Release', async () => {
    stubFetch({ tag_name: 'v0.3.0', html_url: 'https://example.test/r/0.3.0' });

    await expect(checkForUpdate('0.1.0')).resolves.toEqual({
      version: '0.3.0',
      url: 'https://example.test/r/0.3.0',
    });
  });

  it('schweigt, wenn die App aktuell ist', async () => {
    stubFetch({ tag_name: 'v0.1.0', html_url: 'https://example.test' });
    await expect(checkForUpdate('0.1.0')).resolves.toBeNull();
  });

  it('übergeht Entwürfe und Vorabversionen', async () => {
    stubFetch({ tag_name: 'v9.0.0', draft: true });
    await expect(checkForUpdate('0.1.0')).resolves.toBeNull();

    stubFetch({ tag_name: 'v9.0.0', prerelease: true });
    await expect(checkForUpdate('0.1.0')).resolves.toBeNull();
  });

  it('bleibt still, wenn GitHub nicht erreichbar ist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(checkForUpdate('0.1.0')).resolves.toBeNull();
  });

  it('bleibt still beim Rate-Limit', async () => {
    stubFetch({}, 403);
    await expect(checkForUpdate('0.1.0')).resolves.toBeNull();
  });

  it('bleibt still, wenn das Release kein Tag hat', async () => {
    stubFetch({ html_url: 'https://example.test' });
    await expect(checkForUpdate('0.1.0')).resolves.toBeNull();
  });
});
