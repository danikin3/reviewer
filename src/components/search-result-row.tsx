import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MediaBadge } from '@/components/media-badge';
import { Poster } from '@/components/poster';
import { colors, radius, spacing, touchTarget, typography } from '@/theme/theme';
import type { SearchHit } from '@/types/media';

export function SearchResultRow({ hit }: { hit: SearchHit }) {
  return (
    <Link
      href={{
        pathname: '/title/[type]/[id]',
        params: { type: hit.mediaType, id: hit.tmdbId },
      }}
      asChild
    >
      <Pressable
        style={({ pressed }) => [styles.pressable, pressed && styles.rowPressed]}
        accessibilityRole="link"
        accessibilityLabel={`${hit.title}, ${hit.mediaType === 'movie' ? 'Film' : 'Serie'}`}
      >
        {/* Eigenes View statt Layout auf dem Pressable: Link asChild rendert auf
            Web ein <a>, das die Flex-Richtung des Pressable schluckt. */}
        <View style={styles.row}>
          <Poster path={hit.posterPath} width={56} />
          <View style={styles.info}>
            <View style={styles.badgeRow}>
              <MediaBadge mediaType={hit.mediaType} />
              {hit.year !== null && <Text style={styles.year}>{hit.year}</Text>}
            </View>
            <Text style={styles.title} numberOfLines={2}>
              {hit.title}
            </Text>
            {hit.tmdbScore !== null && (
              <Text style={styles.score}>TMDB {hit.tmdbScore.toFixed(1)}</Text>
            )}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: radius.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: touchTarget,
  },
  rowPressed: {
    backgroundColor: colors.surface,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  year: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  title: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  score: {
    ...typography.caption,
    fontFamily: typography.statSmall.fontFamily,
    color: colors.textTertiary,
  },
});
