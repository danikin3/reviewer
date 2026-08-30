import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { describeTmdbError } from '@/api/tmdb/client';
import { getDetails } from '@/api/tmdb/tmdb';
import { EmptyState } from '@/components/empty-state';
import { MediaBadge } from '@/components/media-badge';
import { Poster } from '@/components/poster';
import { StarRating } from '@/components/star-rating';
import { saveRating } from '@/data/diary';
import { useDb } from '@/data/use-db';
import { colors, radius, spacing, touchTarget, typography } from '@/theme/theme';
import type { MediaDetails, MediaType, Rating } from '@/types/media';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'loaded'; details: MediaDetails };

/** ISO-Datum (YYYY-MM-DD) in lokaler Zeit — nicht UTC, sonst kippt der Tag. */
function isoDate(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function todayIso(): string {
  return isoDate(new Date());
}

function yesterdayIso(): string {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return isoDate(date);
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime()) && isoDate(parsed) === value;
}

export default function RateScreen() {
  const params = useLocalSearchParams<{ type: string; id: string }>();
  const router = useRouter();
  const db = useDb();
  const insets = useSafeAreaInsets();

  const mediaType: MediaType = params.type === 'tv' ? 'tv' : 'movie';
  const tmdbId = Number(params.id);

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [rating, setRating] = useState<Rating | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [hasSpoilers, setHasSpoilers] = useState(false);
  const [isRewatch, setIsRewatch] = useState(false);
  const [watchedAt, setWatchedAt] = useState(todayIso());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const details = await getDetails(mediaType, tmdbId);
      setState({ kind: 'loaded', details });
    } catch (error) {
      setState({ kind: 'error', message: describeTmdbError(error) });
    }
  }, [mediaType, tmdbId]);

  useEffect(() => {
    if (Number.isFinite(tmdbId)) {
      load();
    } else {
      setState({ kind: 'error', message: 'Ungültige Titel-ID.' });
    }
  }, [load, tmdbId]);

  const dateValid = isValidIsoDate(watchedAt);
  const canSave =
    state.kind === 'loaded' && dateValid && !saving && (rating !== null || reviewText.trim() !== '');

  async function save() {
    if (state.kind !== 'loaded' || !canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveRating(db, state.details, {
        scope: 'title',
        seasonNumber: null,
        episodeNumber: null,
        rating,
        reviewText: reviewText.trim() === '' ? null : reviewText.trim(),
        hasSpoilers,
        watchedAt,
        isRewatch,
        status: 'watched',
        droppedReason: null,
        tags: [],
      });
      router.back();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.');
      setSaving(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={styles.topButton}
          accessibilityRole="button"
          accessibilityLabel="Abbrechen"
        >
          <Text style={styles.cancelText}>Abbrechen</Text>
        </Pressable>
        <Text style={styles.topTitle}>Bewerten</Text>
        <Pressable
          onPress={save}
          disabled={!canSave}
          style={styles.topButton}
          accessibilityRole="button"
          accessibilityLabel="Bewertung speichern"
        >
          {saving ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={[styles.saveText, !canSave && styles.saveTextDisabled]}>Sichern</Text>
          )}
        </Pressable>
      </View>

      {state.kind === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}

      {state.kind === 'error' && (
        <View style={styles.center}>
          <EmptyState icon="cloud-offline-outline" title="Titel nicht geladen" hint={state.message} />
        </View>
      )}

      {state.kind === 'loaded' && (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.titleRow}>
              <Poster path={state.details.posterPath} width={80} size="detail" />
              <View style={styles.titleInfo}>
                <MediaBadge mediaType={state.details.mediaType} />
                <Text style={styles.title}>{state.details.title}</Text>
                {state.details.year !== null && (
                  <Text style={styles.year}>{state.details.year}</Text>
                )}
              </View>
            </View>

            <View style={styles.starsBlock}>
              <StarRating value={rating} onChange={setRating} />
              <Text style={styles.ratingLabel}>
                {rating === null ? 'Noch keine Bewertung' : `${rating.toFixed(1).replace('.', ',')} von 5`}
              </Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Gesehen am</Text>
              <View style={styles.dateChips}>
                <DateChip
                  label="Heute"
                  active={watchedAt === todayIso()}
                  onPress={() => setWatchedAt(todayIso())}
                />
                <DateChip
                  label="Gestern"
                  active={watchedAt === yesterdayIso()}
                  onPress={() => setWatchedAt(yesterdayIso())}
                />
                <TextInput
                  value={watchedAt}
                  onChangeText={setWatchedAt}
                  placeholder="JJJJ-MM-TT"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.dateInput, !dateValid && styles.dateInputInvalid]}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Datum, an dem du den Titel gesehen hast"
                />
              </View>
              {!dateValid && <Text style={styles.errorText}>Bitte ein Datum als JJJJ-MM-TT angeben.</Text>}
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Review</Text>
              <TextInput
                value={reviewText}
                onChangeText={setReviewText}
                placeholder="Was denkst du darüber? (optional)"
                placeholderTextColor={colors.textTertiary}
                style={styles.reviewInput}
                multiline
                textAlignVertical="top"
                accessibilityLabel="Review-Text"
              />
            </View>

            <ToggleRow
              icon="eye-off-outline"
              label="Enthält Spoiler"
              value={hasSpoilers}
              onChange={setHasSpoilers}
            />
            <ToggleRow
              icon="repeat-outline"
              label="Rewatch"
              value={isRewatch}
              onChange={setIsRewatch}
            />

            {saveError && <Text style={styles.errorText}>{saveError}</Text>}
            {!canSave && !saving && dateValid && (
              <Text style={styles.hintText}>
                Vergib Sterne oder schreib eine Review, um zu sichern.
              </Text>
            )}

            <View style={{ height: insets.bottom + spacing.xxl }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

function DateChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ToggleRow({
  icon,
  label,
  value,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Ionicons name={icon} size={20} color={colors.textSecondary} />
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.accentMuted }}
        thumbColor={value ? colors.accent : colors.textTertiary}
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    height: touchTarget + spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  topButton: {
    minWidth: 80,
    justifyContent: 'center',
  },
  topTitle: {
    ...typography.heading,
    color: colors.text,
  },
  cancelText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  saveText: {
    ...typography.bodyMedium,
    color: colors.accent,
    textAlign: 'right',
  },
  saveTextDisabled: {
    color: colors.textTertiary,
  },
  scroll: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  titleRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  titleInfo: {
    flex: 1,
    gap: spacing.xs,
    justifyContent: 'center',
  },
  title: {
    ...typography.heading,
    color: colors.text,
  },
  year: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  starsBlock: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  ratingLabel: {
    ...typography.statSmall,
    color: colors.textSecondary,
  },
  field: {
    gap: spacing.sm,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  dateChips: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: spacing.lg,
    height: touchTarget,
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.accent,
  },
  chipText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.onAccent,
  },
  dateInput: {
    flex: 1,
    // Ohne minWidth schrumpft ein Input auf Web nicht und läuft über den Rand
    minWidth: 0,
    height: touchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    ...typography.body,
    fontFamily: typography.statSmall.fontFamily,
    color: colors.text,
  },
  dateInputInvalid: {
    borderWidth: 1,
    borderColor: colors.danger,
  },
  reviewInput: {
    minHeight: 110,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    ...typography.body,
    color: colors.text,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTarget,
  },
  toggleLabel: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
  },
  hintText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
