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

Dev: `npx expo start` (Expo Go oder Web). Web nutzt `output: "single"` — der statische Serializer kann den expo-sqlite-Web-Worker nicht auflösen.

Release-APK lokal (Windows, PowerShell):

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
npx expo prebuild -p android --clean
cd android; .\gradlew.bat assembleRelease
# Ergebnis: android/app/build/outputs/apk/release/app-release.apk
```

JDK 21 kommt aus dem Android Studio JBR — kein separates Java nötig.

### Signierung

`android/` wird von `prebuild` neu erzeugt und ist gitignored, deshalb trägt das Config-Plugin `plugins/with-release-signing.js` die Release-Signierung bei jedem Prebuild ein. Zugangsdaten stehen **nie im Repo**, sondern in `~/.gradle/gradle.properties` (`REVIEWER_UPLOAD_*`). Fehlen sie, fällt der Build auf den Debug-Key zurück statt abzubrechen.

- Keystore: `C:\Users\danie\.android-keystores\reviewer-release.keystore`, Alias `reviewer`
- Passwort: `C:\Users\danie\.android-keystores\reviewer-password.txt`
- ⚠️ **Beides sichern.** Ohne diesen Keystore kann keine Update-APK installiert werden, die eine bereits installierte ersetzt — Android verweigert den Austausch bei anderer Signatur.
- Keystore ersetzen: neuen mit `keytool` erzeugen, Pfade in `~/.gradle/gradle.properties` anpassen. Nutzer müssen die App dann einmal deinstallieren.
### Zwei Fallen, die beide schon zugeschlagen haben

1. **BOM in `gradle.properties`.** Windows PowerShells `Set-Content -Encoding utf8` schreibt eines, und es hängt sich an den ersten Property-Namen — Gradle findet ihn nicht und signiert stillschweigend mit dem Debug-Key. Prüfen mit `apksigner verify --print-certs`: steht dort `CN=Android Debug`, ist genau das passiert. Dasselbe gilt beim Pipen an `gh secret set`; dafür das Bash-Werkzeug nehmen.

2. **Fehlender Zeilenumbruch beim Anhängen an `android/gradle.properties`.** Die von `prebuild` erzeugte Datei endet ohne Zeilenende. Wer ohne führendes `echo ""` anhängt, klebt seine erste Zeile an die letzte vorhandene Property und macht deren Wert unbrauchbar. Im CI führte das dazu, dass Expos Autolinking einen zusammengeklebten Parameter bekam und abbrach — Gradle meldete davon nur `command 'node' finished with non-zero exit value 1`.

Wenn Gradle einen nichtssagenden `command 'node'`-Fehler meldet: mit `--info` laufen lassen, dann steht die vollständige Kommandozeile des Aufrufs im Log.

### Automatischer Release

Git-Tag `v*` → `.github/workflows/build-apk.yml` baut die signierte APK und hängt sie ans GitHub Release. `workflow_dispatch` erlaubt Testläufe ohne Tag (APK landet dann nur als Artefakt). Der Workflow prüft nach dem Build die Signatur und bricht ab, wenn sie auf den Debug-Key zurückgefallen ist.

Gesetzte Repository-Secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`. Noch offen: `TMDB_API_KEY` — fehlt es, entsteht eine APK ohne funktionierende Suche statt eines Build-Fehlers.

`.github/workflows/ci.yml` prüft bei jedem Push Typen, Lint und Tests.

## Definition of Done pro Feature

1. Läuft in der Release-APK auf echtem Android-Gerät
2. `tsc --noEmit` sauber, kein `any`, ESLint sauber
3. Lade-, Fehler- und Leerzustände umgesetzt (kein Netz, leere Liste, kein Treffer, fehlender TMDB-Key)
4. `CLAUDE.md`/`README.md` aktualisiert, falls Modell/Setup/Build sich geändert haben

## Architektur-Muster, die eingehalten werden

- **Ladezustände beim Render ableiten, nicht per `setState` im Effect.** Das Ergebnis trägt den Schlüssel des Titels bzw. der Suchanfrage, zu dem es gehört (`{ key, kind, ... }`), und `state` wird daraus berechnet. Verhindert Kaskaden-Renders und das Aufblitzen alter Daten beim Wechsel. ESLint erzwingt das über `react-hooks/set-state-in-effect`.
- **Metadaten cachen, sobald sie da sind** — nicht erst beim Bewerten. Wer nur Episoden abhakt, hinterließe sonst eine Serie ohne Laufzeit und Genres, und die Statistik zählt sie falsch.
- **Statistik-Regeln:** Genres, Regie und Cast zählen pro Titel einmal. Bei der Sehdauer schlagen abgehakte Folgen jede Annahme; nur ohne abgehakte Folgen zählt eine Gesamtbewertung als „ganze Serie gesehen".

## Offene Punkte

- TMDB-Key: Nutzer hat noch keinen Account. Secret `TMDB_API_KEY` im Repo daher noch nicht gesetzt
- APK ist ~110 MB, weil alle vier CPU-Architekturen enthalten sind. ABI-Splits würden auf ~30 MB drücken, kosten aber die „eine Datei für jedes Gerät"-Einfachheit
- v2-Kandidaten: Social über Backend, eigene Listen (UI), Kompatibilitäts-Score, Staffel-Benachrichtigungen, Trakt-Import, Rating-Card, Deep Links
