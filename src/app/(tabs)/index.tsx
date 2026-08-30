import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { listRecentEntries } from '@/data/entries';
import { useDb } from '@/data/use-db';
import { colors, radius, spacing, typography } from '@/theme/theme';
import type { Entry } from '@/types/media';

const PAGE_SIZE = 30;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; entries: Entry[] };

export default function HomeScreen() {
  const db = useDb();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  const load = useCallback(async () => {
    try {
      const entries = await listRecentEntries(db, { limit: PAGE_SIZE });
      setState({ kind: 'ready', entries });
    } catch (error) {
      setState({ kind: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen title="Reviewer">
      {state.kind === 'loading' && <View style={styles.skeleton} />}
      {state.kind === 'error' && (
        <EmptyState icon="alert-circle-outline" title="Tagebuch konnte nicht geladen werden" hint={state.message} />
      )}
      {state.kind === 'ready' && state.entries.length === 0 && (
        <EmptyState
          icon="film-outline"
          title="Noch keine Aktivität"
          hint="Bewerte deinen ersten Film oder deine erste Serie über den Add-Button — dein Tagebuch erscheint hier."
        />
      )}
      {state.kind === 'ready' && state.entries.length > 0 && (
        <FlatList
          data={state.entries}
          keyExtractor={(entry) => String(entry.id)}
          renderItem={({ item }) => (
            <View style={styles.entryCard}>
              <Text style={styles.entryTitle}>
                {item.mediaType === 'movie' ? 'Film' : 'Serie'} #{item.tmdbId}
              </Text>
              {item.rating !== null && <Text style={styles.entryRating}>★ {item.rating}</Text>}
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    height: 96,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  entryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  entryTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  entryRating: {
    ...typography.statSmall,
    color: colors.accent,
  },
});
