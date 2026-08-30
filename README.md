# Reviewer

Filme **und** Serien bewerten, tracken und wiederfinden — in einer App, gleichwertig behandelt. Wie Letterboxd, nur dass Serien (inklusive Staffel- und Episoden-Bewertung) kein Anhängsel sind.

**Lokal-first:** Alle Daten liegen in einer SQLite-Datenbank auf deinem Gerät. Kein Account, kein Login, keine Cloud, kein Tracking.

> 🚧 In aktiver Entwicklung. Der aktuelle Stand ist in [PLAN.md](PLAN.md) dokumentiert.

## Features (geplant für v1)

- 🔍 Suche über Filme und Serien (TMDB)
- ⭐ Bewertungen in Halbschritten (0,5–5 Sterne), Reviews mit Spoiler-Flag
- 📺 Serien richtig: Bewertung pro Serie, Staffel und Episode; Episoden abhaken; Abgebrochen-Status mit Grund
- 📋 Watchlist, Tagebuch (Diary), Tags
- 📊 Statistiken: Sehdauer, Rating-Verteilung, Top-Genres/-Regisseure/-Schauspieler, Jahres-Rückblick
- 🧭 Trending und regelbasierte Empfehlungen mit Begründung
- 📥 Letterboxd-CSV-Import, Datenexport als JSON/CSV
- 🎬 Streaming-Verfügbarkeit (Abo/Leihen/Kaufen) für Region DE

## Installation (Android)

Es gibt keine Play-Store-Version. Die APK kommt aus den [GitHub Releases](../../releases):

1. Neueste `reviewer-vX.Y.Z.apk` aus dem Release herunterladen
2. Auf dem Gerät „Installation aus unbekannten Quellen" für den Browser/Dateimanager erlauben
3. APK öffnen und installieren

Die App prüft beim Start selbst, ob ein neueres Release existiert.

## Entwicklung

Voraussetzungen: Node 20+, npm. Für den nativen Android-Build zusätzlich JDK 17 und das Android SDK.

```bash
git clone https://github.com/danikin3/reviewer.git
cd reviewer
npm install
cp .env.example .env   # TMDB-Key eintragen
npx expo start         # Dev-Server (Expo Go oder Web)
```

Release-APK lokal bauen:

```bash
npx expo prebuild -p android
cd android && ./gradlew assembleRelease
```

## Tech-Stack

Expo (React Native, TypeScript strict) · Expo Router · SQLite (`expo-sqlite`) · `expo-image`

## Attribution

- Film- und Serien-Metadaten von [TMDB](https://www.themoviedb.org/). Diese App verwendet die TMDB-API, wird aber nicht von TMDB unterstützt oder zertifiziert.
- Streaming-Verfügbarkeitsdaten von [JustWatch](https://www.justwatch.com/) (via TMDB).

## Lizenz

[MIT](LICENSE)
