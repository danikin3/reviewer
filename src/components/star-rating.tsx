import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme/theme';
import type { Rating } from '@/types/media';

type StarRatingProps = {
  value: Rating | null;
  onChange: (rating: Rating | null) => void;
  size?: number;
};

/**
 * Fünf Sterne in Halbschritten. Jeder Stern hat zwei Tippflächen:
 * linke Hälfte = halber Stern, rechte Hälfte = ganzer Stern.
 * Erneutes Tippen auf denselben Wert löscht die Bewertung.
 */
export function StarRating({ value, onChange, size = 40 }: StarRatingProps) {
  function select(next: Rating) {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onChange(value === next ? null : next);
  }

  return (
    <View style={styles.row} accessibilityRole="adjustable" accessibilityLabel="Bewertung in Sternen">
      {[1, 2, 3, 4, 5].map((position) => {
        const filled = value !== null && value >= position;
        const half = value !== null && !filled && value >= position - 0.5;
        const icon = filled ? 'star' : half ? 'star-half' : 'star-outline';

        return (
          <View key={position} style={{ width: size, height: size }}>
            <Ionicons
              name={icon}
              size={size}
              color={filled || half ? colors.accent : colors.textTertiary}
            />
            {/* Unsichtbare Tippflächen über dem Symbol */}
            <Pressable
              style={[styles.hitArea, { left: 0, width: size / 2, height: size }]}
              onPress={() => select((position - 0.5) as Rating)}
              accessibilityRole="button"
              accessibilityLabel={`${position - 0.5} Sterne`}
            />
            <Pressable
              style={[styles.hitArea, { left: size / 2, width: size / 2, height: size }]}
              onPress={() => select(position as Rating)}
              accessibilityRole="button"
              accessibilityLabel={`${position} Sterne`}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  hitArea: {
    position: 'absolute',
    top: 0,
  },
});
