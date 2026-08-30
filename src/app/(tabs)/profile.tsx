import { Ionicons } from '@expo/vector-icons';
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
import { listRatedTitles, listWatchlistWithMedia } from '@/data/diary';
import { useDb } from '@/data/use-db';
import { colors, radius, spacing, touchTarget, typography } from '@/theme/theme';
import type { EntryWithMedia, MediaType, Rating } from '@/types/media';

const COLUMNS = 3;
const GRID_LIMIT = 60;

type Tab = 'rated' | 'watchlist';

/** Gemeinsame Form für beide Raster — bewertete Titel und Watchlist. */
interface GridItem {
  key: string;
  mediaType: MediaType;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  rating: Rating | null;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; rated: EntryWithMedia[]; watchlist: GridItem[] };

export default function ProfileScreen() {
  const db = useDb();
  const { width } = useWindowDimensions();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [tab, setTab] = useState<Tab>('rated');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([listRatedTitles(db, { limit: GRID_LIMIT }), listWatchlistWithMedia(db)])
        .then(([rated, watchlistRows]) => {
          if (cancelled) return;
          setState({
            kind: 'ready',
            rated,
            watchlist: watchlistRows.map((row) => ({
              key: `${row.mediaType}-${row.tmdbId}`,
              mediaType: row.mediaType,
              tmdbId: row.tmdbId,
              title: row.title,
              posterPath: row.posterPath,
              rating: null,
            })),
          });
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
  const posterWidth = Math.floor((width - spacing.lg * 2 - spacing.sm * (COLUMNS - 1)) / COLUMNS);

  const items: GridItem[] =
    state.kind !== 'ready'
      ? []
      : tab === 'watchlist'
        ? state.watchlist
        : state.rated.map((item) => ({
            key: String(item.entry.id),
            mediaType: item.entry.mediaType,
            tmdbId: item.entry.tmdbId,
            title: item.title,
            posterPath: item.posterPath,
            rating: item.entry.rating,
          }));

  return (
    <Screen
      title="Profil"
      headerAction={
        <Link href="/settings" asChild>
          <Pressable
            style={styles.settingsButton}
            accessibilityRole="link"
            accessibilityLabel="Einstellungen öffnen"
          >
            <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        </Link>
      }
    >
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
            <Stat
              label="Filme"
              value={state.rated.filter((item) => item.entry.mediaType === 'movie').length}
            />
            <Stat
              label="Serien"
              value={state.rated.filter((item) => item.entry.mediaType === 'tv').length}
            />
            <Stat label="Watchlist" value={state.watchlist.length} />
          </View>

          <View style={styles.tabs}>
            <TabButton
              label="Bewertet"
              active={tab === 'rated'}
              onPress={() => setTab('rated')}
            />
            <TabButton
              label="Watchlist"
              active={tab === 'watchlist'}
              onPress={() => setTab('watchlist')}
            />
          </View>

          {items.length === 0 ? (
            <EmptyState
              icon={tab === 'watchlist' ? 'bookmark-outline' : 'grid-outline'}
              title={tab === 'watchlist' ? 'Watchlist ist leer' : 'Noch nichts bewertet'}
              hint={
                tab === 'watchlist'
                  ? 'Setz Filme und Serien über das Lesezeichen auf der Detailseite hierher.'
                  : 'Deine bewerteten Filme und Serien erscheinen hier als Poster-Raster.'
              }
            />
          ) : (
            <FlatList
              data={items}
              key={`${COLUMNS}-${tab}`}
              numColumns={COLUMNS}
              keyExtractor={(item) => item.key}
              columnWrapperStyle={styles.column}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Link
                  href={{
                    pathname: '/title/[type]/[id]',
                    params: { type: item.mediaType, id: item.tmdbId },
                  }}
                  asChild
                >
                  <Pressable
                    style={({ pressed }) => [pressed && styles.pressed]}
                    accessibilityRole="link"
                    accessibilityLabel={item.title}
                  >
                    <View>
                      <Poster path={item.posterPath} width={posterWidth} />
                      {item.rating !== null && (
                        <View style={styles.gridRating}>
                          <StarDisplay rating={item.rating} size={11} />
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

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
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
    marginBottom: spacing.lg,
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
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  tabActive: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  tabText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.text,
  },
  column: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  gridRating: {
    marginTop: spacing.xs,
  },
  settingsButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexDirection: 'row',
  },
});
