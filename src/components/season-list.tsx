import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native';

import { describeTmdbError } from '@/api/tmdb/client';
import { getSeasonEpisodes } from '@/api/tmdb/tmdb';
import { colors, radius, spacing, touchTarget, typography } from '@/theme/theme';
import type { EpisodeSummary, SeasonSummary } from '@/types/media';

type EpisodeState =
  | { kind: 'collapsed' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; episodes: EpisodeSummary[] };

function SeasonRow({ tmdbId, season }: { tmdbId: number; season: SeasonSummary }) {
  const [state, setState] = useState<EpisodeState>({ kind: 'collapsed' });

  async function toggle() {
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
  }

  const expanded = state.kind !== 'collapsed';

  return (
    <View style={styles.season}>
      <Pressable
        onPress={toggle}
        style={styles.seasonHeader}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${season.name}, ${season.episodeCount} Episoden`}
      >
        <View style={styles.seasonTitleGroup}>
          <Text style={styles.seasonName}>{season.name}</Text>
          <Text style={styles.seasonMeta}>
            {season.episodeCount} {season.episodeCount === 1 ? 'Episode' : 'Episoden'}
            {season.airDate ? ` · ${season.airDate.slice(0, 4)}` : ''}
          </Text>
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
      {state.kind === 'loaded' &&
        state.episodes.map((episode) => (
          <View key={episode.episodeNumber} style={styles.episode}>
            <Text style={styles.episodeNumber}>
              {episode.seasonNumber}.{String(episode.episodeNumber).padStart(2, '0')}
            </Text>
            <View style={styles.episodeInfo}>
              <Text style={styles.episodeName} numberOfLines={2}>
                {episode.name}
              </Text>
              {episode.runtimeMinutes !== null && (
                <Text style={styles.episodeMeta}>{episode.runtimeMinutes} Min.</Text>
              )}
            </View>
          </View>
        ))}
    </View>
  );
}

/** Staffel- und Episodenliste einer Serie, ausklappbar. */
export function SeasonList({ tmdbId, seasons }: { tmdbId: number; seasons: SeasonSummary[] }) {
  if (seasons.length === 0) return null;
  return (
    <View style={styles.root}>
      {seasons.map((season) => (
        <SeasonRow key={season.seasonNumber} tmdbId={tmdbId} season={season} />
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
  seasonName: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  seasonMeta: {
    ...typography.caption,
    color: colors.textTertiary,
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
  episode: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  episodeNumber: {
    ...typography.statSmall,
    color: colors.textTertiary,
    minWidth: 44,
  },
  episodeInfo: {
    flex: 1,
  },
  episodeName: {
    ...typography.body,
    color: colors.text,
  },
  episodeMeta: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
