import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { DiaryCard } from '@/components/diary-card';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { listDiary } from '@/data/diary';
import { useDb } from '@/data/use-db';
import { colors } from '@/theme/theme';
import type { EntryWithMedia } from '@/types/media';

const PAGE_SIZE = 30;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; items: EntryWithMedia[] };

export default function HomeScreen() {
  const db = useDb();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  // Nach dem Bewerten kehrt man hierher zurück — dann neu laden.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listDiary(db, { limit: PAGE_SIZE })
        .then((items) => {
          if (!cancelled) setState({ kind: 'ready', items });
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setState({
              kind: 'error',
              message: error instanceof Error ? error.message : String(error),
            });
          }
        });
      return () => {
        cancelled = true;
      };
    }, [db])
  );

  return (
    <Screen title="Reviewer">
      {state.kind === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}

      {state.kind === 'error' && (
        <EmptyState
          icon="alert-circle-outline"
          title="Tagebuch konnte nicht geladen werden"
          hint={state.message}
        />
      )}

      {state.kind === 'ready' && state.items.length === 0 && (
        <EmptyState
          icon="film-outline"
          title="Noch keine Aktivität"
          hint="Bewerte deinen ersten Film oder deine erste Serie über den Add-Button — dein Tagebuch erscheint hier."
        />
      )}

      {state.kind === 'ready' && state.items.length > 0 && (
        <FlatList
          data={state.items}
          keyExtractor={(item) => String(item.entry.id)}
          renderItem={({ item }) => <DiaryCard item={item} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
