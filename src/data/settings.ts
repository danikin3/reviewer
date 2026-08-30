import type { DbClient } from '@/data/db-client';

/** Bekannte Settings-Schlüssel — zentral, damit keine Tippfehler-Keys entstehen. */
export type SettingKey = 'region' | 'theme';

export async function getSetting(db: DbClient, key: SettingKey): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return row?.value ?? null;
}

export async function setSetting(db: DbClient, key: SettingKey, value: string): Promise<void> {
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}
