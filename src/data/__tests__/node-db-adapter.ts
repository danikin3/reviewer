import { DatabaseSync } from 'node:sqlite';

import type { DbClient, RunResult, SqlValue } from '@/data/db-client';

/**
 * Test-Adapter: bildet das DbClient-Interface auf Nodes eingebautes
 * SQLite ab. Nur für Tests — die App benutzt expo-sqlite.
 */
export class NodeDbAdapter implements DbClient {
  private readonly db: DatabaseSync;

  constructor() {
    this.db = new DatabaseSync(':memory:');
  }

  async execAsync(source: string): Promise<void> {
    this.db.exec(source);
  }

  async runAsync(source: string, params: SqlValue[]): Promise<RunResult> {
    const result = this.db.prepare(source).run(...params);
    return {
      lastInsertRowId: Number(result.lastInsertRowid),
      changes: Number(result.changes),
    };
  }

  async getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]> {
    return this.db.prepare(source).all(...params) as T[];
  }

  async getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null> {
    const row = this.db.prepare(source).get(...params);
    return (row as T | undefined) ?? null;
  }

  close(): void {
    this.db.close();
  }
}
