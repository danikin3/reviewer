/**
 * Minimale DB-Schnittstelle, die der Repository-Layer benutzt.
 * In der App erfüllt `expo-sqlite` dieses Interface direkt,
 * in Tests ein Adapter über `node:sqlite`. Dadurch bleibt der
 * gesamte Daten-Layer ohne Gerät testbar.
 */

export type SqlValue = string | number | null | Uint8Array;

export interface RunResult {
  lastInsertRowId: number;
  changes: number;
}

export interface DbClient {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params: SqlValue[]): Promise<RunResult>;
  getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null>;
}
