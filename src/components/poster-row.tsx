import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MediaBadge } from '@/components/media-badge';
import { Poster } from '@/components/poster';
import { colors, spacing, typography } from '@/theme/theme';
import type { SearchHit } from '@/types/media';

/** Horizontaler Poster-Scroller, wie ihn Streaming-Apps verwenden. */
export function PosterRow({ items }: { items: SearchHit[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {items.map((hit) => (
        <Link
          key={`${hit.mediaType}-${hit.tmdbId}`}
          href={{
            pathname: '/title/[type]/[id]',
            params: { type: hit.mediaType, id: hit.tmdbId },
          }}
          asChild
        >
          <Pressable
            style={({ pressed }) => [pressed && styles.pressed]}
            accessibilityRole="link"
            accessibilityLabel={hit.title}
          >
            <View style={styles.item}>
              <Poster path={hit.posterPath} width={110} />
              <View style={styles.badgeRow}>
                <MediaBadge mediaType={hit.mediaType} />
              </View>
              <Text style={styles.title} numberOfLines={2}>
                {hit.title}
              </Text>
              {hit.year !== null && <Text style={styles.year}>{hit.year}</Text>}
            </View>
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.md,
    paddingRight: spacing.lg,
  },
  item: {
    width: 110,
    gap: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  pressed: {
    opacity: 0.7,
  },
  title: {
    ...typography.caption,
    color: colors.text,
  },
  year: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
