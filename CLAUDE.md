# Reviewer

Mobile App zum Bewerten und Tracken von Filmen **und Serien** — gleichwertig behandelt (USP gegenüber Letterboxd). **Lokal-first:** alle Nutzerdaten liegen in SQLite auf dem Gerät, kein Backend, kein Account, kein Login. Kein Store: Code öffentlich auf GitHub (`danikin3/reviewer`), APK über GitHub Releases, nur Android. UI-Sprache: Deutsch.

## Architektur-Entscheidung (2026-08-30)

Der Nutzer hat sich gegen Supabase/Backend entschieden. Social-Features (Follows, Feed, Likes, Kommentare) sind damit **nicht in v1** und kommen erst, falls später ein Backend dazukommt. Der Repository-Layer (`src/data/*`) ist die einzige Schicht mit DB-Zugriff, damit ein Backend-Wechsel/Sync später nicht die halbe App anfasst.

## Tech-Stack

- Expo SDK 57, React Native 0.86, TypeScript strict, kein `any`
- Expo Router (file-based), React Context + Hooks (kein Redux)
- Daten: `expo-sqlite` (lokale DB), Schema-Migrationen in `src/data/migrations.ts` (versioniert über `PRAGMA user_version`)
- Bilder: `expo-image` (Caching)
- Build: `expo prebuild` + Gradle (lokal oder GitHub Actions). **Kein EAS, kein Expo-Account.**
- Kein Firebase, kein Analytics, kein Tracking

## TMDB

- Einzige Metadaten-Quelle. Key kommt aus `.env` (`EXPO_PUBLIC_TMDB_API_KEY`), aktuell Platzhalter — Nutzer legt später einen Account an
- ⚠️ Ohne Backend steckt der Key im App-Bundle. Für den privaten Build ok; der Key wird nie committet. Im README dokumentiert
- Alle Calls über `src/api/tmdb/` (typisiert, Retry, Rate-Limit-Handling), Responses in `media_cache` (SQLite) gecached
- Bilder direkt von `image.tmdb.org`: `w185` Listen, `w500` Detail, nie `original` im Feed
- TMDB- und JustWatch-Attribution im Settings-Screen und README (Pflicht)

## Ordnerstruktur

```
src/app/                Expo-Router-Routen
  (tabs)/               Tab-Screens: index (Home/Tagebuch), discover, add, stats, profile
  title/[type]/[id]     Titel-Detail (movie|tv)
src/components/         Wiederverwendbare UI-Komponenten
src/data/               Repository-Layer — EINZIGER Ort mit SQLite-Zugriff
src/api/tmdb/           TMDB-Client
src/theme/theme.ts      Alle Farben, Spacing (4/8/12/16/24/32), Radius, Typografie
src/types/              Gemeinsame TS-Typen
.github/workflows/      ci.yml, build-apk.yml
```

## Namenskonventionen

- Dateien kebab-case, Komponenten PascalCase, DB snake_case
- Conventional Commits (`feat:`, `fix:`, `chore:`)
- Keine Hardcoded-Farben/Abstände in Komponenten — alles aus `theme.ts`

## Datenmodell (SQLite)

- `entries` — ein Ereignis-Log für alles Bewerten/Sehen. `scope` ∈ `title|season|episode` (Serien-Gesamtbewertung primär, Staffel/Episode optional), `rating` 0.5–5.0 in Halbschritten, `status` ∈ `watched|dropped` (+ `dropped_reason`), `watched_at`, `is_rewatch`, `tags` (JSON-Array)
- `watchlist` — eigene Tabelle (Filme + Serien gemischt), kein Status in `entries`
- `media_cache` — TMDB-Payload als JSON + extrahierte Spalten (`title`, `poster_path`, `release_date`, `runtime_minutes`, `genres`)
- Zählerstände/Statistiken werden immer aus `entries` berechnet, nie redundant gespeichert

## Build

- Dev: `npx expo start` (Expo Go oder Web)
- Release-APK lokal: `npx expo prebuild -p android` + `cd android && .\gradlew assembleRelease` (braucht JDK 17; Android Studio JBR nutzbar)
- Release: Git-Tag `v*` → `.github/workflows/build-apk.yml` baut die APK und hängt sie ans GitHub Release
- Keystore: lokal erzeugt, **nie im Repo**, als GitHub-Secret (base64) für den CI-Build
- App prüft beim Start die GitHub-Releases-API auf neuere Version, dezenter Hinweis

## Definition of Done pro Feature

1. Läuft in der Release-APK auf echtem Android-Gerät
2. `tsc --noEmit` sauber, kein `any`, ESLint sauber
3. Lade-, Fehler- und Leerzustände umgesetzt (kein Netz, leere Liste, kein Treffer, fehlender TMDB-Key)
4. `CLAUDE.md`/`README.md` aktualisiert, falls Modell/Setup/Build sich geändert haben

## Offene Punkte

- TMDB-Key: Platzhalter bis der Nutzer einen Account anlegt
- Lizenz: MIT (Template-LICENSE beibehalten)
- v2-Kandidaten: Social über Backend, eigene Listen (UI), Kompatibilitäts-Score, Staffel-Benachrichtigungen, Trakt-Import, Rating-Card, Deep Links
