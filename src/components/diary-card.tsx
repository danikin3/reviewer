import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Poster } from '@/components/poster';
import { StarDisplay } from '@/components/star-display';
import { colors, radius, spacing, typography } from '@/theme/theme';
import type { EntryWithMedia } from '@/types/media';

/** "2026-08-30" → "30.08.2026" */
function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const [year, month, day] = iso.split('-');
  return year && month && day ? `${day}.${month}.${year}` : null;
}

export function DiaryCard({ item }: { item: EntryWithMedia }) {
  const { entry } = item;
  const watched = formatDate(entry.watchedAt);

  return (
    <Link
      href={{
        pathname: '/title/[type]/[id]',
        params: { type: entry.mediaType, id: entry.tmdbId },
      }}
      asChild
    >
      <Pressable
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
        accessibilityRole="link"
        accessibilityLabel={`${item.title}${entry.rating !== null ? `, ${entry.rating} Sterne` : ''}`}
      >
        <View style={styles.card}>
          <Poster path={item.posterPath} width={64} />
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
              {item.year !== null && <Text style={styles.year}> {item.year}</Text>}
            </Text>

            <View style={styles.metaRow}>
              {entry.rating !== null && <StarDisplay rating={entry.rating} size={14} />}
              {entry.isRewatch && (
                <Ionicons name="repeat" size={14} color={colors.textSecondary} />
              )}
              {entry.status === 'dropped' && (
                <Text style={styles.dropped}>abgebrochen</Text>
              )}
            </View>

            {entry.reviewText && (
              <Text style={styles.review} numberOfLines={entry.hasSpoilers ? 1 : 3}>
                {entry.hasSpoilers ? 'Review enthält Spoiler — antippen zum Lesen' : entry.reviewText}
              </Text>
            )}

            {watched && <Text style={styles.date}>Gesehen am {watched}</Text>}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  info: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  year: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dropped: {
    ...typography.label,
    color: colors.danger,
    textTransform: 'uppercase',
  },
  review: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  date: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
