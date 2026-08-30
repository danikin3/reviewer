import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme/theme';

type EmptyStateProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint?: string;
};

export function EmptyState({ icon, title, hint }: EmptyStateProps) {
  return (
    <View style={styles.root} accessibilityRole="text">
      <Ionicons name={icon} size={40} color={colors.textTertiary} />
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingBottom: spacing.xxl * 2,
  },
  title: {
    ...typography.heading,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  hint: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    maxWidth: 260,
  },
});
