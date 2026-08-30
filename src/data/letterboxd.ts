/**
 * Letterboxd-CSV-Import.
 *
 * Letterboxd exportiert mehrere Dateien. Relevant sind `diary.csv`
 * (mit Sehdatum und Rewatch-Flag) und `ratings.csv` (nur Bewertungen).
 * Beide haben eine Kopfzeile; die Spaltennamen unterscheiden sich leicht,
 * deshalb wird nach Namen statt nach Position gelesen.
 *
 * Parsen und Zuordnen sind bewusst getrennt: das Parsen ist pur und
 * getestet, das Nachschlagen bei TMDB passiert davon unabhängig.
 */

export interface LetterboxdRow {
  title: string;
  year: number | null;
  /** 0,5–5,0 in Halbschritten, falls Letterboxd eine Bewertung kennt */
  rating: number | null;
  watchedAt: string | null;
  isRewatch: boolean;
  tags: string[];
}

/**
 * Zerlegt eine CSV-Zeile nach RFC 4180: Felder in Anführungszeichen dürfen
 * Kommas, Zeilenumbrüche und verdoppelte Anführungszeichen enthalten.
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/** Trennt CSV-Text in Zeilen, ohne Umbrüche innerhalb von Feldern zu zerreißen. */
function splitCsvRows(text: string): string[] {
  const rows: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      if (current.trim() !== '') rows.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim() !== '') rows.push(current);
  return rows;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/^﻿/, '');
}

function parseRating(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === '') return null;
  const value = Number(raw.trim());
  if (!Number.isFinite(value)) return null;
  // Letterboxd bewertet wie Reviewer in Halbschritten von 0,5 bis 5
  if (value < 0.5 || value > 5) return null;
  const rounded = Math.round(value * 2) / 2;
  return rounded >= 0.5 ? rounded : null;
}

function parseYear(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const value = Number(raw.trim());
  return Number.isFinite(value) && value > 1800 && value < 2200 ? value : null;
}

function parseDate(raw: string | undefined): string | null {
  if (raw === undefined || raw.trim() === '') return null;
  const trimmed = raw.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function parseBoolean(raw: string | undefined): boolean {
  return raw !== undefined && ['yes', 'true', '1'].includes(raw.trim().toLowerCase());
}

/**
 * Liest eine Letterboxd-CSV. Unbekannte oder unvollständige Zeilen werden
 * übersprungen statt den ganzen Import abzubrechen — ein Export mit einer
 * kaputten Zeile soll trotzdem die anderen 400 Filme mitbringen.
 */
export function parseLetterboxdCsv(text: string): LetterboxdRow[] {
  const rows = splitCsvRows(text);
  if (rows.length < 2) return [];

  const headers = parseCsvLine(rows[0]).map(normalizeHeader);
  const indexOf = (name: string): number => headers.indexOf(name);

  const nameIndex = indexOf('name');
  if (nameIndex === -1) return [];

  const yearIndex = indexOf('year');
  const ratingIndex = indexOf('rating');
  // diary.csv hat "watched date", ratings.csv nur "date"
  const watchedIndex = indexOf('watched date') !== -1 ? indexOf('watched date') : indexOf('date');
  const rewatchIndex = indexOf('rewatch');
  const tagsIndex = indexOf('tags');

  const parsed: LetterboxdRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const fields = parseCsvLine(rows[i]);
    const title = fields[nameIndex]?.trim();
    if (!title) continue;

    const tags =
      tagsIndex === -1 || !fields[tagsIndex]
        ? []
        : fields[tagsIndex]
            .split(',')
            .map((tag) => tag.trim())
            .filter((tag) => tag !== '');

    parsed.push({
      title,
      year: yearIndex === -1 ? null : parseYear(fields[yearIndex]),
      rating: ratingIndex === -1 ? null : parseRating(fields[ratingIndex]),
      watchedAt: watchedIndex === -1 ? null : parseDate(fields[watchedIndex]),
      isRewatch: rewatchIndex === -1 ? false : parseBoolean(fields[rewatchIndex]),
      tags,
    });
  }

  return parsed;
}

/**
 * Wählt aus TMDB-Treffern den passenden Film zu einer Letterboxd-Zeile.
 * Das Jahr entscheidet, weil Titel sich wiederholen (mehrere „Dune").
 * Ohne Jahr gewinnt der exakte Titeltreffer, sonst der erste Vorschlag.
 */
export function pickBestMatch<T extends { title: string; year: number | null; mediaType: string }>(
  row: LetterboxdRow,
  hits: T[]
): T | null {
  const movies = hits.filter((hit) => hit.mediaType === 'movie');
  if (movies.length === 0) return null;

  const titleMatches = (hit: T): boolean =>
    hit.title.trim().toLowerCase() === row.title.trim().toLowerCase();

  if (row.year !== null) {
    const exact = movies.find((hit) => hit.year === row.year && titleMatches(hit));
    if (exact) return exact;

    const sameYear = movies.find((hit) => hit.year === row.year);
    if (sameYear) return sameYear;

    // Letterboxd und TMDB weichen bei Erscheinungsjahren gelegentlich um
    // eins ab (Festival- vs. Kinostart)
    const nearYear = movies.find(
      (hit) => hit.year !== null && Math.abs(hit.year - (row.year ?? 0)) <= 1
    );
    if (nearYear) return nearYear;
  }

  return movies.find(titleMatches) ?? movies[0];
}
