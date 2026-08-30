/**
 * Update-Prüfung gegen die GitHub-Releases-API.
 *
 * Ohne Play Store erfährt niemand von neuen Versionen, deshalb schaut die
 * App beim Start selbst nach. Der Hinweis bleibt dezent und blockiert nie —
 * schlägt die Prüfung fehl (kein Netz, Rate-Limit), passiert einfach nichts.
 */

const RELEASES_URL = 'https://api.github.com/repos/danikin3/reviewer/releases/latest';

export interface UpdateInfo {
  version: string;
  url: string;
}

interface GitHubRelease {
  tag_name?: string;
  html_url?: string;
  draft?: boolean;
  prerelease?: boolean;
}

/**
 * Vergleicht zwei Versionen nach Semver-Regeln (nur major.minor.patch).
 * Gibt true zurück, wenn `candidate` neuer als `current` ist.
 */
export function isNewerVersion(candidate: string, current: string): boolean {
  const parse = (value: string): number[] =>
    value
      .replace(/^v/, '')
      // Vorabkennzeichnungen wie "-beta.1" spielen für den Vergleich keine Rolle
      .split('-')[0]
      .split('.')
      .map((part) => {
        const parsed = Number(part);
        return Number.isFinite(parsed) ? parsed : 0;
      });

  const a = parse(candidate);
  const b = parse(current);

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left !== right) return left > right;
  }
  return false;
}

/**
 * Fragt das neueste Release ab. Liefert null, wenn die App aktuell ist
 * oder die Prüfung nicht möglich war — Fehler werden bewusst geschluckt,
 * eine fehlgeschlagene Update-Prüfung ist kein Problem des Nutzers.
 */
export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo | null> {
  try {
    const response = await fetch(RELEASES_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) return null;

    const release = (await response.json()) as GitHubRelease;
    if (release.draft === true || release.prerelease === true) return null;

    const tag = release.tag_name;
    if (typeof tag !== 'string' || tag === '') return null;
    if (!isNewerVersion(tag, currentVersion)) return null;

    return {
      version: tag.replace(/^v/, ''),
      url: release.html_url ?? 'https://github.com/danikin3/reviewer/releases/latest',
    };
  } catch {
    return null;
  }
}
