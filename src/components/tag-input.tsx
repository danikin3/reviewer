import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radius, spacing, touchTarget, typography } from '@/theme/theme';

/** Vorschläge, die den meisten Alltag abdecken — frei ergänzbar. */
const SUGGESTIONS = ['im Kino', 'mit Partnerin', 'mit Freunden', 'zu Hause', 'Comfort-Watch'];

type TagInputProps = {
  tags: string[];
  onChange: (tags: string[]) => void;
};

export function TagInput({ tags, onChange }: TagInputProps) {
  const [draft, setDraft] = useState('');

  function add(tag: string) {
    const trimmed = tag.trim();
    if (trimmed === '' || tags.includes(trimmed)) return;
    onChange([...tags, trimmed]);
    setDraft('');
  }

  function remove(tag: string) {
    onChange(tags.filter((existing) => existing !== tag));
  }

  const unusedSuggestions = SUGGESTIONS.filter((suggestion) => !tags.includes(suggestion));

  return (
    <View style={styles.root}>
      {tags.length > 0 && (
        <View style={styles.chips}>
          {tags.map((tag) => (
            <Pressable
              key={tag}
              onPress={() => remove(tag)}
              style={[styles.chip, styles.chipActive]}
              accessibilityRole="button"
              accessibilityLabel={`Tag ${tag} entfernen`}
            >
              <Text style={styles.chipTextActive}>{tag}</Text>
              <Ionicons name="close" size={14} color={colors.onAccent} />
            </Pressable>
          ))}
        </View>
      )}

      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={() => add(draft)}
        placeholder="Tag hinzufügen"
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
        returnKeyType="done"
        autoCapitalize="none"
        accessibilityLabel="Tag eingeben"
      />

      {unusedSuggestions.length > 0 && (
        <View style={styles.chips}>
          {unusedSuggestions.map((suggestion) => (
            <Pressable
              key={suggestion}
              onPress={() => add(suggestion)}
              style={styles.chip}
              accessibilityRole="button"
              accessibilityLabel={`Tag ${suggestion} hinzufügen`}
            >
              <Ionicons name="add" size={14} color={colors.textTertiary} />
              <Text style={styles.chipText}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    height: 34,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  chipTextActive: {
    ...typography.caption,
    color: colors.onAccent,
  },
  input: {
    height: touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: colors.text,
  },
});
