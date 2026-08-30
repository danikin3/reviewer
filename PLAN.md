# PLAN.md — Reviewer (Lokal-first)

Architektur: alle Daten in SQLite auf dem Gerät, kein Backend, kein Login. Social-Features sind auf v2 verschoben (brauchen ein Backend). Jeder Schritt ist einzeln testbar und endet mit einem Commit + Push.

## Schritte

### 1. Scaffold, Theme, Tab-Navigation ✅
Expo SDK 57 (TS strict), Expo Router mit 5 Tabs (Home/Tagebuch, Discover, Add, Statistik, Profil), `theme.ts` (Dark Theme Standard, Spacing-/Radius-/Typo-Skala), `.env.example`, README-Grundgerüst, GitHub-Repo `danikin3/reviewer`.
**Test:** App startet (Web-Preview + Expo Go), Tab-Bar funktioniert, Dark Theme sichtbar.

### 2. SQLite-Fundament + Repository-Layer ✅
`expo-sqlite`, Migrationssystem über `PRAGMA user_version`, Tabellen `entries`, `watchlist`, `media_cache`, `settings`. Repository-Layer `src/data/*` mit typisierten Funktionen — ab hier kein SQL außerhalb davon. Unit-Tests für die Migrationslogik.
**Test:** App legt DB beim ersten Start an; Test-Insert überlebt App-Neustart.

### 3. TMDB: Client, Suche, Titel-Detail ✅
Typisierter TMDB-Client (`.env`-Key, Platzhalter-tauglich: ohne Key sichtbarer Hinweis statt Crash), Cache über `media_cache`. Suche (`/search/multi`) mit Typ-Badge im Discover-Tab. Titel-Detail: Poster, Backdrop, Jahr, Laufzeit bzw. Staffeln/Episoden, Genres, Synopsis, Cast, Trailer-Link, TMDB-Score; bei Serien ausklappbare Staffel-/Episodenliste.
**Test:** „Breaking Bad" und „Heat" suchen, Detailseiten korrekt; Flugmodus → Fehlerzustand; ohne Key → Hinweis.

### 4. Bewerten → v0.1-Release-APK ✅ 🎯
Add-Tab als Bottom-Sheet: suchen → bewerten. 5 Sterne in Halbschritten mit Haptik, Review-Text, Spoiler-Flag, „Gesehen am", Rewatch. Profil mit 3-Spalten-Poster-Grid der bewerteten Titel. Home zeigt die eigene Aktivität chronologisch.
**Test:** Release-APK auf dem Handy: bewerten, Eintrag im Grid, überlebt Neustart. → Tag `v0.1.0`, erstes Release.

### 5. Serien-Tiefe (der USP) ✅
Bewertung auf drei Ebenen (Serie primär, Staffel/Episode optional). Episoden abhaken, „ganze Staffel abhaken", Fortschrittsanzeige. `dropped`-Status mit Grund, in der UI gleichwertig neben „gesehen".
**Test:** Staffel abhaken, Episoden einzeln bewerten, Serie gesamt bewerten, andere Serie abbrechen — alles auf Detailseite und Profil sichtbar.

### 6. Watchlist, Diary, Tags ✅
Watchlist (Filme + Serien gemischt). Diary: chronologisches Tagebuch nach `watched_at`. Freie Tags als Chips im Add-Sheet.
**Test:** Titel auf Watchlist, verschwindet dort nach Bewertung; Diary korrekt sortiert.

### 7. Statistiken ✅
Aus `entries` berechnet: gesehene Filme/Serien/Episoden, Sehdauer (Std/Tage), Rating-Verteilung als Balkendiagramm, Top-Genres/-Regisseure/-Schauspieler, Aktivität pro Jahr/Monat, Jahres-Rückblick. Unit-Tests für die Berechnungen.
**Test:** Zahlen stimmen gegen handgezählte Referenzdaten.

### 8. Discover: Trending, Empfehlungen, Streaming-Verfügbarkeit ✅
Trending (`/trending/all/week`). Regelbasiertes Scoring (Kandidaten aus `/recommendations` der Top-20 eigenen Titel, Genre-/Keyword-Match, Gewichtung nach Rating, Abzug für Gesehenes/Watchlist) mit Unit-Tests und Begründung pro Vorschlag. Watch-Provider (Abo/Leihen/Kaufen, Region DE, in Settings umstellbar) hinter `StreamingProvider`-Interface, Link auf TMDB-Watch-Seite, JustWatch-Attribution.
**Test:** Scoring-Tests grün; keine gesehenen Titel in Vorschlägen.

### 9. Import, Export, Settings
Letterboxd-CSV-Import. Datenexport als JSON/CSV (Share-Sheet). „Alle Daten löschen". Settings: Region, Theme, TMDB-/JustWatch-Attribution, Version.
**Test:** Echten Letterboxd-Export importieren; Export enthält alle Einträge; Löschen leert die DB.

### 10. Build- und Release-Automatisierung
`ci.yml` (tsc, ESLint, Tests je Push), `build-apk.yml` (Tag `v*` → Gradle-Build → APK ans GitHub Release, Keystore aus Secret), Update-Check beim Start gegen GitHub-Releases-API, README final (Screenshots, Installation, Attribution).
**Test:** Tag pushen → Release mit APK erscheint; ältere Version zeigt Update-Hinweis.

## v2 (braucht Backend bzw. später)

Social komplett (Accounts, Follows mit Anfragen, Feed, Likes, Kommentare, Nutzersuche, Blockieren), eigene Listen (UI), Kompatibilitäts-Score, Staffel-Benachrichtigungen, Trakt-Import, teilbare Rating-Card, Deep Links.

## Datenmodell (SQLite)

```sql
entries      id INTEGER PK, media_type TEXT CHECK(IN('movie','tv')), tmdb_id INTEGER,
             scope TEXT CHECK(IN('title','season','episode')),
             season_number INTEGER, episode_number INTEGER,
             rating REAL CHECK(rating BETWEEN 0.5 AND 5.0 AND (rating*10) % 5 = 0),
             review_text TEXT, has_spoilers INTEGER DEFAULT 0,
             watched_at TEXT, is_rewatch INTEGER DEFAULT 0,
             status TEXT CHECK(IN('watched','dropped')) DEFAULT 'watched',
             dropped_reason TEXT, tags TEXT /* JSON-Array */,
             created_at TEXT, updated_at TEXT
             -- CHECKs: movie→scope='title'; episode→season+episode gesetzt; season→nur season

watchlist    media_type, tmdb_id, created_at, PK(media_type, tmdb_id)

media_cache  media_type, tmdb_id, payload TEXT /* JSON */, title, poster_path,
             release_date, runtime_minutes, genres TEXT /* JSON */, fetched_at,
             PK(media_type, tmdb_id)

settings     key TEXT PK, value TEXT
```

Indexe: `entries(created_at DESC)`, `entries(media_type, tmdb_id)`, `entries(watched_at)`.
