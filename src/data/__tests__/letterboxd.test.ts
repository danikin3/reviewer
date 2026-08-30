import { describe, expect, it } from 'vitest';

import {
  parseCsvLine,
  parseLetterboxdCsv,
  pickBestMatch,
  type LetterboxdRow,
} from '@/data/letterboxd';

describe('parseCsvLine', () => {
  it('trennt einfache Felder', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('lässt Kommas in Anführungszeichen stehen', () => {
    expect(parseCsvLine('"Lock, Stock and Two Smoking Barrels",1998')).toEqual([
      'Lock, Stock and Two Smoking Barrels',
      '1998',
    ]);
  });

  it('versteht verdoppelte Anführungszeichen als eines', () => {
    expect(parseCsvLine('"Sag ""Hallo""",x')).toEqual(['Sag "Hallo"', 'x']);
  });

  it('behält leere Felder', () => {
    expect(parseCsvLine('a,,c')).toEqual(['a', '', 'c']);
  });
});

describe('parseLetterboxdCsv', () => {
  const diary = [
    'Date,Name,Year,Letterboxd URI,Rating,Rewatch,Tags,Watched Date',
    '2026-08-01,Matrix,1999,https://boxd.it/x,4.5,Yes,"im kino, sci-fi",2026-07-30',
    '2026-08-02,Inception,2010,https://boxd.it/y,5,,,2026-08-02',
  ].join('\n');

  it('liest Titel, Jahr, Bewertung, Datum, Rewatch und Tags', () => {
    const rows = parseLetterboxdCsv(diary);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      title: 'Matrix',
      year: 1999,
      rating: 4.5,
      watchedAt: '2026-07-30',
      isRewatch: true,
      tags: ['im kino', 'sci-fi'],
    });
    expect(rows[1].isRewatch).toBe(false);
    expect(rows[1].tags).toEqual([]);
  });

  it('nimmt bei ratings.csv die Spalte "Date" als Sehdatum', () => {
    const ratings = [
      'Date,Name,Year,Letterboxd URI,Rating',
      '2026-03-05,Heat,1995,https://boxd.it/z,5',
    ].join('\n');

    const rows = parseLetterboxdCsv(ratings);
    expect(rows[0].watchedAt).toBe('2026-03-05');
    expect(rows[0].rating).toBe(5);
  });

  it('kommt mit Windows-Zeilenenden klar', () => {
    const rows = parseLetterboxdCsv(diary.replace(/\n/g, '\r\n'));
    expect(rows).toHaveLength(2);
    expect(rows[0].title).toBe('Matrix');
  });

  it('zerreißt keine Titel mit Komma', () => {
    const csv = [
      'Date,Name,Year,Rating',
      '2026-01-01,"Lock, Stock and Two Smoking Barrels",1998,4',
    ].join('\n');

    const rows = parseLetterboxdCsv(csv);
    expect(rows[0].title).toBe('Lock, Stock and Two Smoking Barrels');
    expect(rows[0].year).toBe(1998);
  });

  it('überspringt kaputte Zeilen statt abzubrechen', () => {
    const csv = [
      'Date,Name,Year,Rating',
      '2026-01-01,Guter Film,2000,4',
      '2026-01-02,,2001,3',
      '2026-01-03,Noch ein Film,2002,5',
    ].join('\n');

    const rows = parseLetterboxdCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.title)).toEqual(['Guter Film', 'Noch ein Film']);
  });

  it('ignoriert Bewertungen außerhalb der Skala', () => {
    const csv = ['Name,Rating', 'A,0', 'B,7', 'C,3.5'].join('\n');
    const rows = parseLetterboxdCsv(csv);

    expect(rows[0].rating).toBeNull();
    expect(rows[1].rating).toBeNull();
    expect(rows[2].rating).toBe(3.5);
  });

  it('rundet auf Halbschritte', () => {
    const rows = parseLetterboxdCsv(['Name,Rating', 'A,3.7'].join('\n'));
    expect(rows[0].rating).toBe(3.5);
  });

  it('liefert bei leerer Datei und reiner Kopfzeile nichts', () => {
    expect(parseLetterboxdCsv('')).toEqual([]);
    expect(parseLetterboxdCsv('Date,Name,Year,Rating')).toEqual([]);
  });

  it('gibt auf, wenn die Namensspalte fehlt', () => {
    expect(parseLetterboxdCsv(['Date,Year,Rating', '2026-01-01,2000,4'].join('\n'))).toEqual([]);
  });

  it('verkraftet ein UTF-8-BOM am Dateianfang', () => {
    const rows = parseLetterboxdCsv('﻿Name,Year,Rating\nMatrix,1999,5');
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Matrix');
  });
});

describe('pickBestMatch', () => {
  const row = (overrides: Partial<LetterboxdRow> = {}): LetterboxdRow => ({
    title: 'Dune',
    year: 2021,
    rating: 5,
    watchedAt: null,
    isRewatch: false,
    tags: [],
    ...overrides,
  });

  const hit = (title: string, year: number | null, mediaType = 'movie') => ({
    title,
    year,
    mediaType,
  });

  it('bevorzugt den Treffer mit passendem Titel und Jahr', () => {
    const match = pickBestMatch(row(), [
      hit('Dune', 1984),
      hit('Dune', 2021),
      hit('Dune: Part Two', 2024),
    ]);
    expect(match?.year).toBe(2021);
  });

  it('verzeiht ein Jahr Abweichung', () => {
    const match = pickBestMatch(row({ year: 2020 }), [hit('Dune', 2021)]);
    expect(match?.year).toBe(2021);
  });

  it('ignoriert Serien — Letterboxd exportiert nur Filme', () => {
    expect(pickBestMatch(row(), [hit('Dune', 2021, 'tv')])).toBeNull();
  });

  it('nimmt ohne Jahr den exakten Titeltreffer', () => {
    const match = pickBestMatch(row({ year: null }), [
      hit('Dune: Part Two', 2024),
      hit('Dune', 1984),
    ]);
    expect(match?.title).toBe('Dune');
  });

  it('liefert null, wenn es gar keinen Film gibt', () => {
    expect(pickBestMatch(row(), [])).toBeNull();
  });
});
