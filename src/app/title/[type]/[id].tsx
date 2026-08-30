import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { describeTmdbError } from '@/api/tmdb/client';
import { backdropUrl, profileUrl } from '@/api/tmdb/images';
import { getDetails } from '@/api/tmdb/tmdb';
import { EmptyState } from '@/components/empty-state';
import { MediaBadge } from '@/components/media-badge';
import { Poster } from '@/components/poster';
import { SeasonList } from '@/components/season-list';
import { colors, radius, spacing, touchTarget, typography } from '@/theme/theme';
import type { MediaDetails, MediaType } from '@/types/media';

type DetailState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; details: MediaDetails };

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
  const insets = useSafeAreaInsets();

  const mediaType: MediaType = params.type === 'tv' ? 'tv' : 'movie';
  const tmdbId = Number(params.id);
  const [state, setState] = useState<DetailState>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const details = await getDetails(mediaType, tmdbId);
      setState({ kind: 'loaded', details });
    } catch (error) {
      setState({ kind: 'error', message: describeTmdbError(error) });
    }
  }, [mediaType, tmdbId]);

  useEffect(() => {
    if (Number.isFinite(tmdbId)) {
      load();
    } else {
      setState({ kind: 'error', message: 'Ungültige Titel-ID.' });
    }
  }, [load, tmdbId]);

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
          <EmptyState icon="cloud-offline-outline" title="Konnte nicht geladen werden" hint={state.message} />
        </View>
      )}

      {state.kind === 'loaded' && (
        <DetailContent details={state.details} topInset={insets.top} />
      )}
    </View>
  );
}

function DetailContent({ details, topInset }: { details: MediaDetails; topInset: number }) {
  const backdrop = backdropUrl(details.backdropPath);
  const runtime = formatRuntime(details.runtimeMinutes);

  const facts: string[] = [];
  if (details.year !== null) facts.push(String(details.year));
  if (details.mediaType === 'tv' && details.seasonCount !== null) {
    facts.push(`${details.seasonCount} ${details.seasonCount === 1 ? 'Staffel' : 'Staffeln'}`);
    if (details.episodeCount !== null) facts.push(`${details.episodeCount} Episoden`);
    if (runtime) facts.push(`ca. ${runtime}/Folge`);
  } else if (runtime) {
    facts.push(runtime);
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {backdrop ? (
        <Image source={{ uri: backdrop }} style={styles.backdrop} contentFit="cover" transition={200} />
      ) : (
        <View style={[styles.backdrop, styles.backdropFallback]} />
      )}

      <View style={[styles.header, { marginTop: -60 }]}>
        <Poster path={details.posterPath} width={110} size="detail" />
        <View style={styles.headerInfo}>
          <MediaBadge mediaType={details.mediaType} />
          <Text style={styles.title}>{details.title}</Text>
          <Text style={styles.facts}>{facts.join(' · ')}</Text>
          {details.tmdbScore !== null && (
            <Text style={styles.score}>TMDB {details.tmdbScore.toFixed(1)}</Text>
          )}
        </View>
      </View>

      <View style={styles.body}>
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
            <Ionicons name="play" size={16} color={colors.onAccent} />
            <Text style={styles.trailerText}>Trailer ansehen</Text>
          </Pressable>
        )}

        {details.mediaType === 'tv' && details.seasons.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Staffeln</Text>
            <SeasonList tmdbId={details.tmdbId} seasons={details.seasons} />
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

        <View style={{ height: topInset + spacing.xxl }} />
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
  score: {
    ...typography.statSmall,
    color: colors.accent,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.lg,
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
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    height: touchTarget,
  },
  trailerText: {
    ...typography.bodyMedium,
    color: colors.onAccent,
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
