import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme/theme';
import type { Rating } from '@/types/media';

type RatingHistogramProps = {
  distribution: { rating: Rating; count: number }[];
};

/** Balkendiagramm der eigenen Bewertungen, 0,5 bis 5 Sterne. */
export function RatingHistogram({ distribution }: RatingHistogramProps) {
  const max = Math.max(...distribution.map((bucket) => bucket.count), 1);

  return (
    <View style={styles.root}>
      <View style={styles.bars}>
        {distribution.map((bucket) => (
          <View key={bucket.rating} style={styles.barColumn}>
            {bucket.count > 0 && <Text style={styles.count}>{bucket.count}</Text>}
            <View
              style={[
                styles.bar,
                {
                  height: Math.max(3, (bucket.count / max) * 96),
                  backgroundColor: bucket.count > 0 ? colors.accent : colors.border,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.axis}>
        <View style={styles.axisLabel}>
          <Ionicons name="star" size={11} color={colors.textTertiary} />
          <Text style={styles.axisText}>0,5</Text>
        </View>
        <View style={styles.axisLabel}>
          <Ionicons name="star" size={11} color={colors.textTertiary} />
          <Text style={styles.axisText}>5</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    height: 120,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    justifyContent: 'flex-end',
  },
  count: {
    ...typography.caption,
    fontFamily: typography.statSmall.fontFamily,
    color: colors.textSecondary,
    fontSize: 11,
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axisLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  axisText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
