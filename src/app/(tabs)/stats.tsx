import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { RatingHistogram } from '@/components/rating-histogram';
import { Screen } from '@/components/screen';
import { computeStats, formatWatchTime, type Counted, type Stats } from '@/data/stats';
import { useDb } from '@/data/use-db';
import { colors, radius, spacing, touchTarget, typography } from '@/theme/theme';

const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; stats: Stats };

export default function StatsScreen() {
  const db = useDb();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  /** null = alle Jahre, sonst der Jahres-Rückblick */
  const [year, setYear] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      computeStats(db, year === null ? {} : { year })
        .then((stats) => {
          if (!cancelled) setState({ kind: 'ready', stats });
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            setState({
              kind: 'error',
              message: error instanceof Error ? error.message : String(error),
            });
          }
        });
      return () => {
        cancelled = true;
      };
    }, [db, year])
  );

  const hasData =
    state.kind === 'ready' &&
    (state.stats.movieCount > 0 || state.stats.seriesCount > 0 || state.stats.droppedCount > 0);

  return (
    <Screen title="Statistik">
      {state.kind === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}

      {state.kind === 'error' && (
        <EmptyState
          icon="alert-circle-outline"
          title="Statistik nicht berechnet"
          hint={state.message}
        />
      )}

      {state.kind === 'ready' && !hasData && state.stats.perYear.length === 0 && (
        <EmptyState
          icon="bar-chart-outline"
          title="Noch keine Daten"
          hint="Gesehene Filme, Serien und Episoden, Sehdauer und Rating-Verteilung erscheinen hier, sobald du bewertest."
        />
      )}

      {state.kind === 'ready' && (hasData || state.stats.perYear.length > 0) && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {state.stats.perYear.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.yearRow}
            >
              <YearChip label="Alles" active={year === null} onPress={() => setYear(null)} />
              {state.stats.perYear.map((bucket) => (
                <YearChip
                  key={bucket.year}
                  label={String(bucket.year)}
                  active={year === bucket.year}
                  onPress={() => setYear(bucket.year)}
                />
              ))}
            </ScrollView>
          )}

          <View style={styles.bigStats}>
            <BigStat value={state.stats.movieCount} label="Filme" />
            <BigStat value={state.stats.seriesCount} label="Serien" />
            <BigStat value={state.stats.episodeCount} label="Episoden" />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Sehdauer</Text>
            <Text style={styles.watchTime}>{formatWatchTime(state.stats.watchTimeMinutes)}</Text>
            <Text style={styles.cardHint}>
              {state.stats.watchTimeMinutes.toLocaleString('de-DE')} Minuten insgesamt
            </Text>
          </View>

          <Section title="Deine Bewertungen">
            <RatingHistogram distribution={state.stats.ratingDistribution} />
            {state.stats.averageRating !== null && (
              <Text style={styles.average}>
                Schnitt: {state.stats.averageRating.toFixed(1).replace('.', ',')} Sterne
              </Text>
            )}
          </Section>

          {state.stats.perMonth.some((m) => m.count > 0) && (
            <Section title={year === null ? 'Aktivität im Jahresverlauf' : `Aktivität ${year}`}>
              <MonthChart data={state.stats.perMonth} />
            </Section>
          )}

          {state.stats.topGenres.length > 0 && (
            <Section title="Top-Genres">
              <RankedList items={state.stats.topGenres} unit="Titel" />
            </Section>
          )}

          {state.stats.topDirectors.length > 0 && (
            <Section title="Top-Regie">
              <RankedList items={state.stats.topDirectors} unit="Titel" />
            </Section>
          )}

          {state.stats.topActors.length > 0 && (
            <Section title="Top-Besetzung">
              <RankedList items={state.stats.topActors} unit="Titel" />
            </Section>
          )}

          {state.stats.droppedCount > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Abgebrochen</Text>
              <Text style={styles.watchTime}>{state.stats.droppedCount}</Text>
              <Text style={styles.cardHint}>
                {state.stats.droppedCount === 1 ? 'Serie' : 'Serien'} nicht zu Ende geschaut
              </Text>
            </View>
          )}

          <View style={{ height: spacing.xxl }} />
        </ScrollView>
      )}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function BigStat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.bigStat}>
      <Text style={styles.bigStatValue}>{value}</Text>
      <Text style={styles.bigStatLabel}>{label}</Text>
    </View>
  );
}

function YearChip({
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
      style={[styles.yearChip, active && styles.yearChipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      <Text style={[styles.yearChipText, active && styles.yearChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function MonthChart({ data }: { data: { month: number; count: number }[] }) {
  const max = Math.max(...data.map((entry) => entry.count), 1);
  return (
    <View>
      <View style={styles.monthBars}>
        {data.map((entry) => (
          <View key={entry.month} style={styles.monthColumn}>
            <View
              style={[
                styles.monthBar,
                {
                  height: Math.max(3, (entry.count / max) * 72),
                  backgroundColor: entry.count > 0 ? colors.badgeTv : colors.border,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={styles.monthLabels}>
        {MONTH_LABELS.map((label, index) => (
          <Text key={index} style={styles.monthLabel}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function RankedList({ items, unit }: { items: Counted[]; unit: string }) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <View style={styles.ranked}>
      {items.map((item, index) => (
        <View key={item.name} style={styles.rankedRow}>
          <Text style={styles.rankedPosition}>{index + 1}</Text>
          <View style={styles.rankedBody}>
            <View style={styles.rankedLabels}>
              <Text style={styles.rankedName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.rankedCount}>
                {item.count} {unit}
              </Text>
            </View>
            <View style={styles.rankedTrack}>
              <View style={[styles.rankedFill, { width: `${(item.count / max) * 100}%` }]} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    gap: spacing.xl,
  },
  yearRow: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  yearChip: {
    paddingHorizontal: spacing.lg,
    height: 36,
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  yearChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  yearChipText: {
    ...typography.statSmall,
    color: colors.textSecondary,
  },
  yearChipTextActive: {
    color: colors.onAccent,
  },
  bigStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  bigStat: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  bigStatValue: {
    ...typography.stat,
    color: colors.text,
  },
  bigStatLabel: {
    ...typography.label,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardLabel: {
    ...typography.label,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  watchTime: {
    ...typography.stat,
    color: colors.accent,
  },
  cardHint: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.text,
  },
  average: {
    ...typography.statSmall,
    color: colors.textSecondary,
  },
  monthBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    height: 80,
  },
  monthColumn: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  monthBar: {
    width: '100%',
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
  },
  monthLabels: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  monthLabel: {
    flex: 1,
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    fontSize: 10,
  },
  ranked: {
    gap: spacing.md,
  },
  rankedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTarget - 10,
  },
  rankedPosition: {
    ...typography.statSmall,
    color: colors.textTertiary,
    width: 16,
  },
  rankedBody: {
    flex: 1,
    gap: spacing.xs,
  },
  rankedLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rankedName: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  rankedCount: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  rankedTrack: {
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  rankedFill: {
    height: '100%',
    backgroundColor: colors.accentMuted,
  },
});
