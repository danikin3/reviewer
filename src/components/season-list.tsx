import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { describeTmdbError } from '@/api/tmdb/client';
import { getSeasonEpisodes } from '@/api/tmdb/tmdb';
import { StarDisplay } from '@/components/star-display';
import {
  episodeKey,
  markEpisodeWatched,
  markSeasonWatched,
  unmarkEpisodeWatched,
  unmarkSeasonWatched,
  type EpisodeKey,
} from '@/data/series-progress';
import { useDb } from '@/data/use-db';
import { colors, radius, spacing, touchTarget, typography } from '@/theme/theme';
import type { EpisodeSummary, Rating, SeasonSummary } from '@/types/media';

type EpisodeState =
  | { kind: 'collapsed' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; episodes: EpisodeSummary[] };

type SeasonListProps = {
  tmdbId: number;
  seasons: SeasonSummary[];
  /** Gesehene Episoden, Schlüssel "staffel-episode" */
  watched: Set<EpisodeKey>;
  /** Bewertungen je Staffel */
  seasonRatings: Map<number, Rating>;
  /** Wird nach jeder Änderung aufgerufen, damit die Detailseite neu lädt. */
  onChange: () => void;
};

function haptic() {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

function SeasonRow({
  tmdbId,
  season,
  watched,
  seasonRating,
  onChange,
}: {
  tmdbId: number;
  season: SeasonSummary;
  watched: Set<EpisodeKey>;
  seasonRating: Rating | undefined;
  onChange: () => void;
}) {
  const db = useDb();
  const router = useRouter();
  const [state, setState] = useState<EpisodeState>({ kind: 'collapsed' });
  const [busy, setBusy] = useState(false);

  const watchedInSeason = Array.from(watched).filter((key) =>
    key.startsWith(`${season.seasonNumber}-`)
  ).length;
  const seasonComplete = season.episodeCount > 0 && watchedInSeason >= season.episodeCount;

  const toggle = useCallback(async () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (state.kind !== 'collapsed') {
      setState({ kind: 'collapsed' });
      return;
    }
    setState({ kind: 'loading' });
    try {
      const episodes = await getSeasonEpisodes(tmdbId, season.seasonNumber);
      setState({ kind: 'loaded', episodes });
    } catch (error) {
      setState({ kind: 'error', message: describeTmdbError(error) });
    }
  }, [state.kind, tmdbId, season.seasonNumber]);

  async function toggleEpisode(episode: EpisodeSummary) {
    haptic();
    const key = episodeKey(episode.seasonNumber, episode.episodeNumber);
    if (watched.has(key)) {
      await unmarkEpisodeWatched(db, tmdbId, episode.seasonNumber, episode.episodeNumber);
    } else {
      await markEpisodeWatched(db, tmdbId, episode.seasonNumber, episode.episodeNumber);
    }
    onChange();
  }

  async function toggleWholeSeason() {
    if (state.kind !== 'loaded' || busy) return;
    setBusy(true);
    haptic();
    try {
      if (seasonComplete) {
        await unmarkSeasonWatched(db, tmdbId, season.seasonNumber);
      } else {
        await markSeasonWatched(
          db,
          tmdbId,
          season.seasonNumber,
          state.episodes.map((episode) => episode.episodeNumber)
        );
      }
      onChange();
    } finally {
      setBusy(false);
    }
  }

  function rate(scope: 'season' | 'episode', episodeNumber?: number) {
    router.push({
      pathname: '/rate/[type]/[id]',
      params: {
        type: 'tv',
        id: tmdbId,
        scope,
        season: season.seasonNumber,
        ...(episodeNumber !== undefined ? { episode: episodeNumber } : {}),
      },
    });
  }

  const expanded = state.kind !== 'collapsed';

  return (
    <View style={styles.season}>
      <Pressable
        onPress={toggle}
        style={styles.seasonHeader}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${season.name}, ${watchedInSeason} von ${season.episodeCount} gesehen`}
      >
        <View style={styles.seasonTitleGroup}>
          <View style={styles.seasonNameRow}>
            <Text style={styles.seasonName}>{season.name}</Text>
            {seasonRating !== undefined && <StarDisplay rating={seasonRating} size={12} />}
          </View>
          <Text style={styles.seasonMeta}>
            {watchedInSeason > 0
              ? `${watchedInSeason}/${season.episodeCount} gesehen`
              : `${season.episodeCount} ${season.episodeCount === 1 ? 'Episode' : 'Episoden'}`}
            {season.airDate ? ` · ${season.airDate.slice(0, 4)}` : ''}
          </Text>
          {season.episodeCount > 0 && watchedInSeason > 0 && (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, (watchedInSeason / season.episodeCount) * 100)}%` },
                ]}
              />
            </View>
          )}
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>

      {state.kind === 'loading' && (
        <ActivityIndicator color={colors.accent} style={styles.seasonLoading} />
      )}
      {state.kind === 'error' && <Text style={styles.seasonError}>{state.message}</Text>}

      {state.kind === 'loaded' && (
        <>
          <View style={styles.seasonActions}>
            <Pressable
              onPress={toggleWholeSeason}
              disabled={busy}
              style={styles.seasonAction}
              accessibilityRole="button"
              accessibilityLabel={
                seasonComplete ? 'Ganze Staffel als ungesehen markieren' : 'Ganze Staffel abhaken'
              }
            >
              <Ionicons
                name={seasonComplete ? 'checkmark-done-circle' : 'checkmark-done-circle-outline'}
                size={18}
                color={seasonComplete ? colors.success : colors.textSecondary}
              />
              <Text style={styles.seasonActionText}>
                {seasonComplete ? 'Staffel zurücksetzen' : 'Ganze Staffel abhaken'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => rate('season')}
              style={styles.seasonAction}
              accessibilityRole="button"
              accessibilityLabel={`${season.name} bewerten`}
            >
              <Ionicons name="star-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.seasonActionText}>Staffel bewerten</Text>
            </Pressable>
          </View>

          {state.episodes.map((episode) => {
            const isWatched = watched.has(
              episodeKey(episode.seasonNumber, episode.episodeNumber)
            );
            return (
              <View key={episode.episodeNumber} style={styles.episode}>
                <Pressable
                  onPress={() => toggleEpisode(episode)}
                  style={styles.checkbox}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isWatched }}
                  accessibilityLabel={`${episode.name} als gesehen markieren`}
                >
                  <Ionicons
                    name={isWatched ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={isWatched ? colors.success : colors.textTertiary}
                  />
                </Pressable>

                <View style={styles.episodeInfo}>
                  <Text style={styles.episodeName} numberOfLines={2}>
                    <Text style={styles.episodeNumber}>
                      {episode.seasonNumber}.{String(episode.episodeNumber).padStart(2, '0')}{' '}
                    </Text>
                    {episode.name}
                  </Text>
                  {episode.runtimeMinutes !== null && (
                    <Text style={styles.episodeMeta}>{episode.runtimeMinutes} Min.</Text>
                  )}
                </View>

                <Pressable
                  onPress={() => rate('episode', episode.episodeNumber)}
                  style={styles.episodeRate}
                  accessibilityRole="button"
                  accessibilityLabel={`Folge ${episode.episodeNumber} bewerten`}
                >
                  <Ionicons name="star-outline" size={18} color={colors.textTertiary} />
                </Pressable>
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

/** Staffel- und Episodenliste einer Serie: ausklappbar, abhakbar, bewertbar. */
export function SeasonList({
  tmdbId,
  seasons,
  watched,
  seasonRatings,
  onChange,
}: SeasonListProps) {
  if (seasons.length === 0) return null;
  return (
    <View style={styles.root}>
      {seasons.map((season) => (
        <SeasonRow
          key={season.seasonNumber}
          tmdbId={tmdbId}
          season={season}
          watched={watched}
          seasonRating={seasonRatings.get(season.seasonNumber)}
          onChange={onChange}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  season: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  seasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    minHeight: touchTarget,
  },
  seasonTitleGroup: {
    flex: 1,
    gap: 2,
    paddingVertical: spacing.sm,
  },
  seasonNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  seasonName: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  seasonMeta: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  progressTrack: {
    height: 3,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    marginTop: spacing.xs,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success,
  },
  seasonLoading: {
    paddingVertical: spacing.md,
  },
  seasonError: {
    ...typography.caption,
    color: colors.danger,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  seasonActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  seasonAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: touchTarget,
  },
  seasonActionText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  episode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  checkbox: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.md,
  },
  episodeInfo: {
    flex: 1,
  },
  episodeNumber: {
    ...typography.statSmall,
    color: colors.textTertiary,
  },
  episodeName: {
    ...typography.body,
    color: colors.text,
  },
  episodeMeta: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  episodeRate: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
