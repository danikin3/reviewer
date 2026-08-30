import { useSQLiteContext } from 'expo-sqlite';

import type { DbClient } from '@/data/db-client';

/**
 * Zugriff auf die App-Datenbank für den Repository-Layer.
 * Die expo-sqlite-Datenbank erfüllt das DbClient-Interface strukturell.
 */
export function useDb(): DbClient {
  return useSQLiteContext();
}
