# Reviewer

Filme **und** Serien bewerten, tracken und wiederfinden — in einer App, gleichwertig behandelt. Wie Letterboxd, nur dass Serien kein Anhängsel sind: du bewertest eine Serie insgesamt, einzelne Staffeln und einzelne Folgen, hakst Episoden ab und brichst Serien mit Grund ab.

**Lokal-first:** Alle Daten liegen in einer SQLite-Datenbank auf deinem Gerät. Kein Account, kein Login, keine Cloud, kein Tracking.

## Features

- 🔍 **Suche** über Filme und Serien in einem gemeinsamen Ergebnis-Feed
- ⭐ **Bewerten** von 0,5 bis 5 Sternen in Halbschritten, mit Review, Spoiler-Flag, Sehdatum und Rewatch-Markierung
- 📺 **Serien richtig**: drei Bewertungsebenen (Serie, Staffel, Episode), Episoden abhaken samt „ganze Staffel", Fortschrittsanzeige, Abgebrochen-Status mit Grund
- 📋 **Watchlist** für Filme und Serien gemischt
- 📖 **Tagebuch** aller Bewertungen chronologisch, mit freien Tags
- 📊 **Statistiken**: Sehdauer, Rating-Verteilung, Top-Genres, -Regie und -Besetzung, Aktivität im Jahresverlauf, Jahres-Rückblick
- 🧭 **Discover**: Trending der Woche und regelbasierte Empfehlungen mit Begründung („Weil dir X und Y gefallen haben")
- 🎬 **Streaming-Verfügbarkeit** gruppiert nach Abo, Leihen und Kaufen, Region einstellbar
- 📥 **Letterboxd-Import** aus der CSV, **Export** als JSON oder CSV

## Installation (Android)

Es gibt keine Play-Store-Version. Die APK kommt aus den [GitHub Releases](../../releases):

1. Neueste `Reviewer-vX.Y.Z.apk` aus dem aktuellen Release herunterladen
2. Auf dem Gerät die Installation aus unbekannten Quellen für den Browser oder Dateimanager erlauben
3. APK öffnen und installieren

Die App prüft beim Start selbst, ob ein neueres Release vorliegt, und blendet einen dezenten Hinweis ein.

## TMDB-Schlüssel

Suche, Detailseiten und Empfehlungen brauchen einen kostenlosen TMDB-API-Schlüssel. Ohne ihn zeigt die App einen Hinweis statt Suchergebnissen; Bewerten, Watchlist, Tagebuch und Statistiken funktionieren trotzdem.

Schlüssel unter [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) anlegen und in die `.env` eintragen:

```
EXPO_PUBLIC_TMDB_API_KEY=dein_schluessel
```

> ⚠️ Ohne Backend landet der Schlüssel beim Build im App-Bundle und ist aus der APK auslesbar. Für den privaten Gebrauch ist das vertretbar; die `.env` gehört trotzdem nie ins Repo. Wer das vermeiden will, braucht einen Proxy-Dienst zwischen App und TMDB.

## Entwicklung

Voraussetzungen: Node 20+, npm. Für den nativen Android-Build zusätzlich JDK 17+ und das Android SDK (beides bringt Android Studio mit).

```bash
git clone https://github.com/danikin3/reviewer.git
cd reviewer
npm install
cp .env.example .env   # TMDB-Schlüssel eintragen
npx expo start         # Dev-Server (Expo Go oder Web)
```

Prüfen:

```bash
npm run typecheck && npm run lint && npm test
```

## APK bauen

**Automatisch:** Ein Git-Tag `v*` löst den Workflow [`build-apk.yml`](.github/workflows/build-apk.yml) aus, der die signierte APK baut und ans GitHub Release hängt. Nötige Repository-Secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` und optional `TMDB_API_KEY`.

**Lokal (Windows/PowerShell):**

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
npx expo prebuild -p android --clean
cd android; .\gradlew.bat assembleRelease
```

Ergebnis: `android/app/build/outputs/apk/release/app-release.apk`.

Die Release-Signierung trägt das Config-Plugin [`plugins/with-release-signing.js`](plugins/with-release-signing.js) beim Prebuild ein — `android/` wird dabei neu erzeugt, manuelle Änderungen dort wären also verloren. Die Zugangsdaten kommen aus `~/.gradle/gradle.properties` und liegen nie im Repo. Fehlen sie, baut Gradle mit dem Debug-Key weiter.

Ob die Signierung geklappt hat, verrät:

```bash
apksigner verify --print-certs app-release.apk
```

Steht dort `CN=Android Debug`, wurde der Release-Key nicht gefunden.

## Tech-Stack

Expo SDK 57 (React Native, TypeScript strict) · Expo Router · SQLite via `expo-sqlite` · `expo-image`

Architektur: `src/data/` ist die einzige Schicht mit SQL-Zugriff, `src/api/tmdb/` die einzige mit TMDB-Zugriff. Komponenten sprechen mit keiner von beiden direkt.

## Attribution

- Film- und Serien-Metadaten von [TMDB](https://www.themoviedb.org/). Diese App verwendet die TMDB-API, wird aber nicht von TMDB unterstützt oder zertifiziert.
- Streaming-Verfügbarkeit von [JustWatch](https://www.justwatch.com/), bereitgestellt über TMDB. Ohne Preisangaben — TMDB liefert keine.

## Lizenz

[MIT](LICENSE)
