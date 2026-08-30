import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Poster } from '@/components/poster';
import { Screen } from '@/components/screen';
import { StarDisplay } from '@/components/star-display';
import { listRatedTitles } from '@/data/diary';
import { useDb } from '@/data/use-db';
import { colors, spacing, typography } from '@/theme/theme';
import type { EntryWithMedia } from '@/types/media';

const COLUMNS = 3;
const GRID_LIMIT = 60;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; items: EntryWithMedia[] };

export default function ProfileScreen() {
  const db = useDb();
  const { width } = useWindowDimensions();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listRatedTitles(db, { limit: GRID_LIMIT })
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

  // Screen-Padding links/rechts plus die Lücken zwischen den Spalten
  const posterWidth = Math.floor(
    (width - spacing.lg * 2 - spacing.sm * (COLUMNS - 1)) / COLUMNS
  );

  const movieCount =
    state.kind === 'ready'
      ? state.items.filter((item) => item.entry.mediaType === 'movie').length
      : 0;
  const tvCount =
    state.kind === 'ready'
      ? state.items.filter((item) => item.entry.mediaType === 'tv').length
      : 0;

  return (
    <Screen title="Profil">
      {state.kind === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}

      {state.kind === 'error' && (
        <EmptyState icon="alert-circle-outline" title="Profil nicht geladen" hint={state.message} />
      )}

      {state.kind === 'ready' && (
        <>
          <View style={styles.stats}>
            <Stat label="Filme" value={movieCount} />
            <Stat label="Serien" value={tvCount} />
            <Stat label="Bewertungen" value={state.items.length} />
          </View>

          {state.items.length === 0 ? (
            <EmptyState
              icon="grid-outline"
              title="Noch nichts bewertet"
              hint="Deine bewerteten Filme und Serien erscheinen hier als Poster-Raster."
            />
          ) : (
            <FlatList
              data={state.items}
              key={COLUMNS}
              numColumns={COLUMNS}
              keyExtractor={(item) => String(item.entry.id)}
              columnWrapperStyle={styles.column}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Link
                  href={{
                    pathname: '/title/[type]/[id]',
                    params: { type: item.entry.mediaType, id: item.entry.tmdbId },
                  }}
                  asChild
                >
                  <Pressable
                    style={({ pressed }) => [styles.gridItem, pressed && styles.pressed]}
                    accessibilityRole="link"
                    accessibilityLabel={item.title}
                  >
                    <View>
                      <Poster path={item.posterPath} width={posterWidth} />
                      {item.entry.rating !== null && (
                        <View style={styles.gridRating}>
                          <StarDisplay rating={item.entry.rating} size={11} />
                        </View>
                      )}
                    </View>
                  </Pressable>
                </Link>
              )}
            />
          )}
        </>
      )}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.xl,
  },
  stat: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    ...typography.stat,
    color: colors.text,
  },
  statLabel: {
    ...typography.label,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  column: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  gridItem: {
    borderRadius: 0,
  },
  pressed: {
    opacity: 0.7,
  },
  gridRating: {
    marginTop: spacing.xs,
  },
});
