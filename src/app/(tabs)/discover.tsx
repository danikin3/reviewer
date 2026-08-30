import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { describeTmdbError, hasApiKey } from '@/api/tmdb/client';
import { getTrending } from '@/api/tmdb/tmdb';
import { EmptyState } from '@/components/empty-state';
import { MediaBadge } from '@/components/media-badge';
import { MediaSearch } from '@/components/media-search';
import { Poster } from '@/components/poster';
import { PosterRow } from '@/components/poster-row';
import { Screen } from '@/components/screen';
import { buildRecommendations } from '@/data/build-recommendations';
import type { Recommendation } from '@/data/recommendations';
import { useDb } from '@/data/use-db';
import { colors, radius, spacing, typography } from '@/theme/theme';
import type { SearchHit } from '@/types/media';

type FeedState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; trending: SearchHit[]; recommendations: Recommendation[] };

export default function DiscoverScreen() {
  const db = useDb();
  const [state, setState] = useState<FeedState>({ kind: 'loading' });
  const keyMissing = !hasApiKey();

  useFocusEffect(
    useCallback(() => {
      if (keyMissing) {
        setState({ kind: 'ready', trending: [], recommendations: [] });
        return;
      }

      let cancelled = false;
      setState({ kind: 'loading' });

      Promise.all([getTrending(), buildRecommendations(db)])
        .then(([trending, recommendations]) => {
          if (!cancelled) setState({ kind: 'ready', trending, recommendations });
        })
        .catch((error: unknown) => {
          if (!cancelled) setState({ kind: 'error', message: describeTmdbError(error) });
        });

      return () => {
        cancelled = true;
      };
    }, [db, keyMissing])
  );

  return (
    <Screen title="Discover">
      <MediaSearch
        target="detail"
        idleTitle="Wonach suchst du?"
        idleHint="Filme und Serien erscheinen gemeinsam in einem Ergebnis-Feed."
        renderIdle={() => (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.feed}>
            {keyMissing && (
              <EmptyState
                icon="key-outline"
                title="Kein TMDB-Schlüssel hinterlegt"
                hint="Trage EXPO_PUBLIC_TMDB_API_KEY in die .env ein, dann erscheinen hier Trending und Empfehlungen."
              />
            )}

            {!keyMissing && state.kind === 'loading' && (
              <View style={styles.center}>
                <ActivityIndicator color={colors.accent} />
              </View>
            )}

            {!keyMissing && state.kind === 'error' && (
              <EmptyState
                icon="cloud-offline-outline"
                title="Discover nicht geladen"
                hint={state.message}
              />
            )}

            {state.kind === 'ready' && state.recommendations.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Für dich</Text>
                {state.recommendations.slice(0, 10).map((item) => (
                  <RecommendationCard key={`${item.mediaType}-${item.tmdbId}`} item={item} />
                ))}
              </View>
            )}

            {state.kind === 'ready' &&
              state.recommendations.length === 0 &&
              state.trending.length > 0 && (
                <View style={styles.hintCard}>
                  <Text style={styles.hintTitle}>Noch keine Empfehlungen</Text>
                  <Text style={styles.hintText}>
                    Bewerte ein paar Filme oder Serien mit 3,5 Sternen oder mehr — daraus baut
                    Reviewer Vorschläge mit Begründung.
                  </Text>
                </View>
              )}

            {state.kind === 'ready' && state.trending.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Diese Woche im Trend</Text>
                <PosterRow items={state.trending} />
              </View>
            )}
          </ScrollView>
        )}
      />
    </Screen>
  );
}

function RecommendationCard({ item }: { item: Recommendation }) {
  return (
    <Link
      href={{ pathname: '/title/[type]/[id]', params: { type: item.mediaType, id: item.tmdbId } }}
      asChild
    >
      <Pressable
        style={({ pressed }) => [pressed && styles.pressed]}
        accessibilityRole="link"
        accessibilityLabel={`${item.title}. ${item.reason}`}
      >
        <View style={styles.card}>
          <Poster path={item.posterPath} width={64} />
          <View style={styles.cardInfo}>
            <View style={styles.cardBadgeRow}>
              <MediaBadge mediaType={item.mediaType} />
              {item.year !== null && <Text style={styles.cardYear}>{item.year}</Text>}
            </View>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.cardReason} numberOfLines={2}>
              {item.reason}
            </Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  feed: {
    gap: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  center: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.text,
  },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardInfo: {
    flex: 1,
    gap: spacing.xs,
    justifyContent: 'center',
  },
  cardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardYear: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  cardTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  cardReason: {
    ...typography.caption,
    color: colors.accent,
  },
  pressed: {
    opacity: 0.7,
  },
  hintCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  hintTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  hintText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
