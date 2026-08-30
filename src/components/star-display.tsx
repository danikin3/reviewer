import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme/theme';
import type { Rating } from '@/types/media';

/** Reine Anzeige einer Bewertung — nicht antippbar. */
export function StarDisplay({ rating, size = 16 }: { rating: Rating; size?: number }) {
  return (
    <View style={styles.row} accessibilityLabel={`${rating} von 5 Sternen`}>
      {[1, 2, 3, 4, 5].map((position) => {
        const filled = rating >= position;
        const half = !filled && rating >= position - 0.5;
        if (!filled && !half) return null;
        return (
          <Ionicons
            key={position}
            name={filled ? 'star' : 'star-half'}
            size={size}
            color={colors.accent}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 1,
  },
});
