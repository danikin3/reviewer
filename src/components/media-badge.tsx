import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme/theme';
import type { MediaType } from '@/types/media';

/** Kennzeichnet, ob ein Treffer ein Film oder eine Serie ist. */
export function MediaBadge({ mediaType }: { mediaType: MediaType }) {
  const isMovie = mediaType === 'movie';
  return (
    <View style={[styles.badge, { backgroundColor: isMovie ? colors.badgeMovie : colors.badgeTv }]}>
      <Text style={styles.text}>{isMovie ? 'FILM' : 'SERIE'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  text: {
    ...typography.label,
    color: colors.text,
  },
});
