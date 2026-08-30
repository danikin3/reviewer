import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, touchTarget, typography } from '@/theme/theme';

/** Häufige Abbruchgründe — bei Serien der wichtigste Unterschied zu Filmen. */
const REASONS = [
  'Wurde langweilig',
  'Zu viele Staffeln',
  'Handlung verloren',
  'Keine Zeit mehr',
] as const;

type DroppedSheetProps = {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (reason: string | null) => void;
};

export function DroppedSheet({ visible, onCancel, onConfirm }: DroppedSheetProps) {
  const [reason, setReason] = useState('');

  function confirm() {
    const trimmed = reason.trim();
    onConfirm(trimmed === '' ? null : trimmed);
    setReason('');
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="Schließen" />
      <View style={styles.sheet}>
        <Text style={styles.title}>Serie abbrechen</Text>
        <Text style={styles.hint}>Warum hast du aufgehört? (optional)</Text>

        <View style={styles.chips}>
          {REASONS.map((preset) => (
            <Pressable
              key={preset}
              onPress={() => setReason(preset)}
              style={[styles.chip, reason === preset && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: reason === preset }}
              accessibilityLabel={preset}
            >
              <Text style={[styles.chipText, reason === preset && styles.chipTextActive]}>
                {preset}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Eigener Grund"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          accessibilityLabel="Eigener Abbruchgrund"
        />

        <View style={styles.actions}>
          <Pressable onPress={onCancel} style={styles.secondary} accessibilityRole="button">
            <Text style={styles.secondaryText}>Abbrechen</Text>
          </Pressable>
          <Pressable onPress={confirm} style={styles.primary} accessibilityRole="button">
            <Text style={styles.primaryText}>Als abgebrochen markieren</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    height: touchTarget,
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.text,
  },
  input: {
    height: touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  secondary: {
    flex: 1,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  primary: {
    flex: 2,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.danger,
  },
  primaryText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
});
