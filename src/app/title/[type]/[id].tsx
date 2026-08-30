import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { describeTmdbError } from '@/api/tmdb/client';
import { backdropUrl, profileUrl } from '@/api/tmdb/images';
import { getDetails, getWatchProviders } from '@/api/tmdb/tmdb';
import { DroppedSheet } from '@/components/dropped-sheet';
import { EmptyState } from '@/components/empty-state';
import { MediaBadge } from '@/components/media-badge';
import { Poster } from '@/components/poster';
import { SeasonList } from '@/components/season-list';
import { StarDisplay } from '@/components/star-display';
import { WatchProviders } from '@/components/watch-providers';
import { addToWatchlistWithMedia } from '@/data/diary';
import { getSetting } from '@/data/settings';
import { upsertCachedMedia } from '@/data/media-cache';
import { isOnWatchlist, removeFromWatchlist } from '@/data/watchlist';
import {
  getDroppedStatus,
  getSeasonRatings,
  getSeriesRating,
  getWatchedEpisodes,
  markSeriesDropped,
  type EpisodeKey,
} from '@/data/series-progress';
import { useDb } from '@/data/use-db';
import { colors, radius, spacing, touchTarget, typography } from '@/theme/theme';
import type { MediaDetails, MediaType, Rating, WatchAvailability } from '@/types/media';

type DetailState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; details: MediaDetails };

/** Geladenes Ergebnis samt Titel, zu dem es gehört. */
type LoadResult =
  | { key: string; kind: 'loaded'; details: MediaDetails }
  | { key: string; kind: 'error'; message: string };

/** Was die App selbst über den Titel weiß — aus der lokalen DB, nicht von TMDB. */
interface OwnData {
  ownRating: Rating | null;
  watched: Set<EpisodeKey>;
  seasonRatings: Map<number, Rating>;
  dropped: boolean;
  droppedReason: string | null;
  onWatchlist: boolean;
}

const EMPTY_OWN: OwnData = {
  ownRating: null,
  watched: new Set(),
  seasonRatings: new Map(),
  dropped: false,
  droppedReason: null,
  onWatchlist: false,
};

/** „2 Std. 16 Min." statt „136 Min." — so liest es sich wie im Kinoprogramm. */
function formatRuntime(minutes: number | null): string | null {
  if (minutes === null || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} Min.`;
  return rest === 0 ? `${hours} Std.` : `${hours} Std. ${rest} Min.`;
}

export default function TitleDetailScreen() {
  const params = useLocalSearchParams<{ type: string; id: string }>();
  const router = useRouter();
  const db = useDb();
  const insets = useSafeAreaInsets();

  const mediaType: MediaType = params.type === 'tv' ? 'tv' : 'movie';
  const tmdbId = Number(params.id);

  /**
   * Das Ergebnis trägt den Titel, zu dem es gehört. Dadurch lässt sich der
   * Ladezustand beim Render ableiten statt ihn per setState zu setzen — und
   * beim Wechsel auf einen anderen Titel blitzen nie kurz dessen Vorgängerdaten auf.
   */
  const [result, setResult] = useState<LoadResult | null>(null);
  const [own, setOwn] = useState<OwnData>(EMPTY_OWN);
  const [droppedSheetOpen, setDroppedSheetOpen] = useState(false);
  const [availability, setAvailability] = useState<WatchAvailability | null>(null);

  const routeKey = `${mediaType}-${tmdbId}`;

  const state: DetailState = !Number.isFinite(tmdbId)
    ? { kind: 'error', message: 'Ungültige Titel-ID.' }
    : result === null || result.key !== routeKey
      ? { kind: 'loading' }
      : result.kind === 'loaded'
        ? { kind: 'loaded', details: result.details }
        : { kind: 'error', message: result.message };

  const loadOwn = useCallback(async () => {
    if (!Number.isFinite(tmdbId)) return;
    const onWatchlist = await isOnWatchlist(db, mediaType, tmdbId);

    if (mediaType === 'movie') {
      const rows = await db.getAllAsync<{ rating: number }>(
        `SELECT rating FROM entries
         WHERE media_type = 'movie' AND tmdb_id = ? AND scope = 'title' AND rating IS NOT NULL
         ORDER BY created_at DESC LIMIT 1`,
        [tmdbId]
      );
      setOwn({
        ...EMPTY_OWN,
        ownRating: (rows[0]?.rating ?? null) as Rating | null,
        onWatchlist,
      });
      return;
    }

    const [ownRating, watched, seasonRatings, droppedStatus] = await Promise.all([
      getSeriesRating(db, tmdbId),
      getWatchedEpisodes(db, tmdbId),
      getSeasonRatings(db, tmdbId),
      getDroppedStatus(db, tmdbId),
    ]);
    setOwn({
      ownRating: ownRating as Rating | null,
      watched,
      seasonRatings: seasonRatings as Map<number, Rating>,
      dropped: droppedStatus.dropped,
      droppedReason: droppedStatus.reason,
      onWatchlist,
    });
  }, [db, mediaType, tmdbId]);

  useEffect(() => {
    if (!Number.isFinite(tmdbId)) return;
    let cancelled = false;

    (async () => {
      try {
        const details = await getDetails(mediaType, tmdbId);
        if (cancelled) return;
        setResult({ key: routeKey, kind: 'loaded', details });

        // Metadaten sofort cachen, nicht erst beim Bewerten: von hier aus kann
        // man Episoden abhaken, und ohne Cache hätte die Statistik dann weder
        // Laufzeit noch Genres der Serie.
        await upsertCachedMedia(db, {
          mediaType: details.mediaType,
          tmdbId: details.tmdbId,
          payload: details,
          title: details.title,
          posterPath: details.posterPath,
          releaseDate: details.year !== null ? `${details.year}-01-01` : null,
          runtimeMinutes: details.runtimeMinutes,
          genres: details.genres,
        });
      } catch (error) {
        if (!cancelled) {
          setResult({ key: routeKey, kind: 'error', message: describeTmdbError(error) });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db, mediaType, tmdbId, routeKey]);

  // Verfügbarkeit separat laden: fehlt sie, soll die Seite trotzdem stehen
  useEffect(() => {
    if (!Number.isFinite(tmdbId)) return;
    let cancelled = false;

    (async () => {
      try {
        const region = (await getSetting(db, 'region')) ?? 'DE';
        const result = await getWatchProviders(mediaType, tmdbId, region);
        if (!cancelled) setAvailability(result);
      } catch {
        if (!cancelled) setAvailability(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db, mediaType, tmdbId]);

  // Nach dem Bewerten kehrt man hierher zurück — eigene Daten neu laden.
  useFocusEffect(
    useCallback(() => {
      loadOwn();
    }, [loadOwn])
  );

  async function confirmDropped(reason: string | null) {
    setDroppedSheetOpen(false);
    await markSeriesDropped(db, tmdbId, reason);
    await loadOwn();
  }

  async function toggleWatchlist() {
    if (state.kind !== 'loaded') return;
    if (own.onWatchlist) {
      await removeFromWatchlist(db, mediaType, tmdbId);
    } else {
      await addToWatchlistWithMedia(db, state.details);
    }
    await loadOwn();
  }

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />

      <Pressable
        onPress={() => router.back()}
        style={[styles.backButton, { top: insets.top + spacing.sm }]}
        accessibilityRole="button"
        accessibilityLabel="Zurück"
      >
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>

      {state.kind === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}

      {state.kind === 'error' && (
        <View style={styles.center}>
          <EmptyState
            icon="cloud-offline-outline"
            title="Konnte nicht geladen werden"
            hint={state.message}
          />
        </View>
      )}

      {state.kind === 'loaded' && (
        <DetailContent
          details={state.details}
          own={own}
          bottomInset={insets.bottom}
          onReloadOwn={loadOwn}
          onOpenDroppedSheet={() => setDroppedSheetOpen(true)}
          onToggleWatchlist={toggleWatchlist}
          availability={availability}
        />
      )}

      <DroppedSheet
        visible={droppedSheetOpen}
        onCancel={() => setDroppedSheetOpen(false)}
        onConfirm={confirmDropped}
      />
    </View>
  );
}

function DetailContent({
  details,
  own,
  bottomInset,
  onReloadOwn,
  onOpenDroppedSheet,
  onToggleWatchlist,
  availability,
}: {
  details: MediaDetails;
  own: OwnData;
  bottomInset: number;
  onReloadOwn: () => void;
  onOpenDroppedSheet: () => void;
  onToggleWatchlist: () => void;
  availability: WatchAvailability | null;
}) {
  const backdrop = backdropUrl(details.backdropPath);
  const runtime = formatRuntime(details.runtimeMinutes);
  const isSeries = details.mediaType === 'tv';

  const facts: string[] = [];
  if (details.year !== null) facts.push(String(details.year));
  if (isSeries && details.seasonCount !== null) {
    facts.push(`${details.seasonCount} ${details.seasonCount === 1 ? 'Staffel' : 'Staffeln'}`);
    if (details.episodeCount !== null) facts.push(`${details.episodeCount} Episoden`);
    if (runtime) facts.push(`ca. ${runtime}/Folge`);
  } else if (runtime) {
    facts.push(runtime);
  }

  const watchedCount = own.watched.size;
  const totalEpisodes = details.episodeCount ?? 0;

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {backdrop ? (
        <Image
          source={{ uri: backdrop }}
          style={styles.backdrop}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[styles.backdrop, styles.backdropFallback]} />
      )}

      <View style={styles.header}>
        <Poster path={details.posterPath} width={110} size="detail" />
        <View style={styles.headerInfo}>
          <MediaBadge mediaType={details.mediaType} />
          <Text style={styles.title}>{details.title}</Text>
          <Text style={styles.facts}>{facts.join(' · ')}</Text>
          <View style={styles.scoreRow}>
            {details.tmdbScore !== null && (
              <Text style={styles.score}>TMDB {details.tmdbScore.toFixed(1)}</Text>
            )}
            {own.ownRating !== null && (
              <View style={styles.ownRating}>
                <Text style={styles.ownRatingLabel}>Deine</Text>
                <StarDisplay rating={own.ownRating} size={13} />
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.body}>
        {own.dropped && (
          <View style={styles.droppedBanner}>
            <Ionicons name="stop-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.droppedText}>
              Abgebrochen{own.droppedReason ? ` · ${own.droppedReason}` : ''}
            </Text>
          </View>
        )}

        {isSeries && totalEpisodes > 0 && watchedCount > 0 && (
          <View style={styles.progressBlock}>
            <View style={styles.progressLabels}>
              <Text style={styles.progressText}>
                {watchedCount} von {totalEpisodes} Episoden gesehen
              </Text>
              <Text style={styles.progressPercent}>
                {Math.round((watchedCount / totalEpisodes) * 100)} %
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, (watchedCount / totalEpisodes) * 100)}%` },
                ]}
              />
            </View>
          </View>
        )}

        <View style={styles.actionRow}>
          <Link
            href={{
              pathname: '/rate/[type]/[id]',
              params: { type: details.mediaType, id: details.tmdbId },
            }}
            asChild
          >
            <Pressable
              style={styles.rateButton}
              accessibilityRole="button"
              accessibilityLabel={`${details.title} bewerten`}
            >
              <Ionicons name="star" size={16} color={colors.onAccent} />
              <Text style={styles.rateText}>Bewerten</Text>
            </Pressable>
          </Link>

          <Pressable
            onPress={onToggleWatchlist}
            style={[styles.secondaryButton, own.onWatchlist && styles.secondaryButtonActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: own.onWatchlist }}
            accessibilityLabel={
              own.onWatchlist ? 'Von der Watchlist entfernen' : 'Auf die Watchlist setzen'
            }
          >
            <Ionicons
              name={own.onWatchlist ? 'bookmark' : 'bookmark-outline'}
              size={16}
              color={own.onWatchlist ? colors.accent : colors.textSecondary}
            />
          </Pressable>

          {isSeries && !own.dropped && (
            <Pressable
              onPress={onOpenDroppedSheet}
              style={styles.secondaryButton}
              accessibilityRole="button"
              accessibilityLabel="Serie als abgebrochen markieren"
            >
              <Ionicons name="stop-circle-outline" size={16} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {details.genres.length > 0 && (
          <View style={styles.chips}>
            {details.genres.map((genre) => (
              <View key={genre} style={styles.chip}>
                <Text style={styles.chipText}>{genre}</Text>
              </View>
            ))}
          </View>
        )}

        {details.directors.length > 0 && (
          <Text style={styles.directors}>
            {details.mediaType === 'movie' ? 'Regie' : 'Idee'}: {details.directors.join(', ')}
          </Text>
        )}

        {details.overview && <Text style={styles.overview}>{details.overview}</Text>}

        {details.trailerKey && (
          <Pressable
            style={styles.trailerButton}
            onPress={() =>
              WebBrowser.openBrowserAsync(`https://www.youtube.com/watch?v=${details.trailerKey}`)
            }
            accessibilityRole="button"
            accessibilityLabel="Trailer auf YouTube ansehen"
          >
            <Ionicons name="play" size={16} color={colors.text} />
            <Text style={styles.trailerText}>Trailer ansehen</Text>
          </Pressable>
        )}

        {availability && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Wo läuft es?</Text>
            <WatchProviders availability={availability} />
          </View>
        )}

        {isSeries && details.seasons.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Staffeln</Text>
            <SeasonList
              tmdbId={details.tmdbId}
              seasons={details.seasons}
              watched={own.watched}
              seasonRatings={own.seasonRatings}
              onChange={onReloadOwn}
            />
          </View>
        )}

        {details.cast.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Besetzung</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.castRow}
            >
              {details.cast.map((member) => {
                const url = profileUrl(member.profilePath);
                return (
                  <View key={member.tmdbId} style={styles.castMember}>
                    {url ? (
                      <Image source={{ uri: url }} style={styles.castImage} contentFit="cover" />
                    ) : (
                      <View style={[styles.castImage, styles.castImageFallback]}>
                        <Ionicons name="person" size={24} color={colors.textTertiary} />
                      </View>
                    )}
                    <Text style={styles.castName} numberOfLines={2}>
                      {member.name}
                    </Text>
                    {member.character && (
                      <Text style={styles.castCharacter} numberOfLines={1}>
                        {member.character}
                      </Text>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={{ height: bottomInset + spacing.xxl }} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  backButton: {
    position: 'absolute',
    left: spacing.lg,
    zIndex: 10,
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.full,
    backgroundColor: 'rgba(11, 13, 16, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingBottom: spacing.xxl,
  },
  backdrop: {
    width: '100%',
    height: 220,
    backgroundColor: colors.surface,
  },
  backdropFallback: {
    backgroundColor: colors.surfaceElevated,
  },
  header: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'flex-end',
    marginTop: -60,
  },
  headerInfo: {
    flex: 1,
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  facts: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  score: {
    ...typography.statSmall,
    color: colors.accent,
  },
  ownRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ownRatingLabel: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  droppedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  droppedText: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  progressBlock: {
    gap: spacing.sm,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  progressPercent: {
    ...typography.statSmall,
    color: colors.success,
  },
  progressTrack: {
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    height: touchTarget,
  },
  rateText: {
    ...typography.bodyMedium,
    color: colors.onAccent,
  },
  secondaryButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonActive: {
    borderColor: colors.accent,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  directors: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  overview: {
    ...typography.body,
    color: colors.textSecondary,
  },
  trailerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    height: touchTarget,
  },
  trailerText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.text,
  },
  castRow: {
    gap: spacing.md,
  },
  castMember: {
    width: 88,
    gap: spacing.xs,
  },
  castImage: {
    width: 88,
    height: 110,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  castImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  castName: {
    ...typography.caption,
    color: colors.text,
  },
  castCharacter: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
