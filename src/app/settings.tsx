import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { Stack, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { buildCsvExport, buildJsonExport, countStoredData, deleteAllUserData } from '@/data/export';
import { importLetterboxdCsv, type ImportProgress } from '@/data/import-letterboxd';
import { getSetting, setSetting } from '@/data/settings';
import { useDb } from '@/data/use-db';
import { colors, radius, spacing, touchTarget, typography } from '@/theme/theme';

/** Regionen für die Streaming-Verfügbarkeit. */
const REGIONS = [
  { code: 'DE', label: 'Deutschland' },
  { code: 'AT', label: 'Österreich' },
  { code: 'CH', label: 'Schweiz' },
  { code: 'US', label: 'USA' },
] as const;

export default function SettingsScreen() {
  const db = useDb();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [region, setRegion] = useState('DE');
  const [counts, setCounts] = useState({ entries: 0, watchlist: 0 });
  const [busy, setBusy] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

  const reload = useCallback(async () => {
    const [storedRegion, stored] = await Promise.all([
      getSetting(db, 'region'),
      countStoredData(db),
    ]);
    setRegion(storedRegion ?? 'DE');
    setCounts(stored);
  }, [db]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function changeRegion(code: string) {
    setRegion(code);
    await setSetting(db, 'region', code);
  }

  /** Schreibt den Export in eine Datei und öffnet das Teilen-Menü. */
  async function share(kind: 'json' | 'csv') {
    setBusy(kind);
    try {
      const content = kind === 'json' ? await buildJsonExport(db) : await buildCsvExport(db);
      const stamp = new Date().toISOString().slice(0, 10);
      const file = new File(Paths.cache, `reviewer-export-${stamp}.${kind}`);
      if (file.exists) file.delete();
      file.create();
      file.write(content);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: kind === 'json' ? 'application/json' : 'text/csv',
          dialogTitle: 'Reviewer-Export teilen',
        });
      } else {
        Alert.alert('Export erstellt', `Die Datei liegt unter:\n${file.uri}`);
      }
    } catch (error) {
      Alert.alert('Export fehlgeschlagen', error instanceof Error ? error.message : 'Unbekannter Fehler');
    } finally {
      setBusy(null);
    }
  }

  async function importCsv() {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', '*/*'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || picked.assets.length === 0) return;

      setBusy('import');
      const file = new File(picked.assets[0].uri);
      const text = file.textSync();

      const result = await importLetterboxdCsv(db, text, setImportProgress);
      setImportProgress(null);
      await reload();

      const notFoundHint =
        result.notFound.length === 0
          ? ''
          : `\n\nNicht gefunden (${result.notFound.length}):\n${result.notFound.slice(0, 10).join('\n')}${
              result.notFound.length > 10 ? '\n…' : ''
            }`;

      Alert.alert(
        'Import abgeschlossen',
        `${result.imported} von ${result.total} Filmen übernommen.${notFoundHint}`
      );
    } catch (error) {
      Alert.alert('Import fehlgeschlagen', error instanceof Error ? error.message : 'Unbekannter Fehler');
    } finally {
      setBusy(null);
      setImportProgress(null);
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Wirklich alle Daten löschen?',
      `${counts.entries} Einträge und ${counts.watchlist} Watchlist-Titel werden endgültig gelöscht. Das lässt sich nicht rückgängig machen.`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Endgültig löschen',
          style: 'destructive',
          onPress: async () => {
            setBusy('delete');
            try {
              await deleteAllUserData(db);
              await reload();
              Alert.alert('Gelöscht', 'Alle Bewertungen und die Watchlist wurden entfernt.');
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  }

  const version = Constants.expoConfig?.version ?? '0.0.0';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Zurück"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.topTitle}>Einstellungen</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Section title="Region für Streaming-Anbieter">
          <View style={styles.chips}>
            {REGIONS.map((entry) => (
              <Pressable
                key={entry.code}
                onPress={() => changeRegion(entry.code)}
                style={[styles.chip, region === entry.code && styles.chipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: region === entry.code }}
                accessibilityLabel={entry.label}
              >
                <Text style={[styles.chipText, region === entry.code && styles.chipTextActive]}>
                  {entry.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section title="Deine Daten">
          <Text style={styles.info}>
            {counts.entries} {counts.entries === 1 ? 'Eintrag' : 'Einträge'} · {counts.watchlist} auf
            der Watchlist
          </Text>

          <Row
            icon="download-outline"
            label="Aus Letterboxd importieren"
            hint="CSV-Export aus Letterboxd auswählen (diary.csv oder ratings.csv)"
            onPress={importCsv}
            busy={busy === 'import'}
          />
          {importProgress !== null && (
            <View style={styles.progressBox}>
              <Text style={styles.progressText}>
                {importProgress.processed} von {importProgress.total} · {importProgress.imported}{' '}
                übernommen
              </Text>
              {importProgress.currentTitle !== '' && (
                <Text style={styles.progressTitle} numberOfLines={1}>
                  {importProgress.currentTitle}
                </Text>
              )}
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${
                        importProgress.total === 0
                          ? 0
                          : (importProgress.processed / importProgress.total) * 100
                      }%`,
                    },
                  ]}
                />
              </View>
            </View>
          )}

          <Row
            icon="document-text-outline"
            label="Als JSON exportieren"
            hint="Vollständige Sicherung inklusive aller Felder"
            onPress={() => share('json')}
            busy={busy === 'json'}
          />
          <Row
            icon="grid-outline"
            label="Als CSV exportieren"
            hint="Für Tabellenkalkulation"
            onPress={() => share('csv')}
            busy={busy === 'csv'}
          />
          <Row
            icon="trash-outline"
            label="Alle Daten löschen"
            hint="Bewertungen, Watchlist und Zwischenspeicher"
            onPress={confirmDelete}
            busy={busy === 'delete'}
            destructive
          />
        </Section>

        <Section title="Datenquellen">
          <Pressable
            onPress={() => WebBrowser.openBrowserAsync('https://www.themoviedb.org/')}
            accessibilityRole="link"
            accessibilityLabel="TMDB öffnen"
          >
            <Text style={styles.attribution}>
              Film- und Serien-Metadaten von <Text style={styles.link}>TMDB</Text>. Diese App
              verwendet die TMDB-API, wird aber nicht von TMDB unterstützt oder zertifiziert.
            </Text>
          </Pressable>

          <Pressable
            onPress={() => WebBrowser.openBrowserAsync('https://www.justwatch.com/')}
            accessibilityRole="link"
            accessibilityLabel="JustWatch öffnen"
          >
            <Text style={styles.attribution}>
              Streaming-Verfügbarkeit von <Text style={styles.link}>JustWatch</Text>, bereitgestellt
              über TMDB. Ohne Preisangaben.
            </Text>
          </Pressable>
        </Section>

        <Section title="Über Reviewer">
          <Text style={styles.info}>Version {version}</Text>
          <Text style={styles.attribution}>
            Alle Daten liegen ausschließlich auf diesem Gerät. Kein Konto, keine Cloud, kein
            Tracking.
          </Text>
          <Pressable
            onPress={() => WebBrowser.openBrowserAsync('https://github.com/danikin3/reviewer')}
            accessibilityRole="link"
            accessibilityLabel="Quellcode auf GitHub öffnen"
          >
            <Text style={styles.link}>Quellcode auf GitHub</Text>
          </Pressable>
        </Section>

        <View style={{ height: insets.bottom + spacing.xxl }} />
      </ScrollView>
    </View>
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

function Row({
  icon,
  label,
  hint,
  onPress,
  busy,
  destructive,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  onPress: () => void;
  busy: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={20} color={destructive ? colors.danger : colors.textSecondary} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      {busy ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    height: touchTarget + spacing.sm,
  },
  backButton: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    ...typography.heading,
    color: colors.text,
  },
  scroll: {
    padding: spacing.lg,
    gap: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    height: touchTarget,
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  chipTextActive: {
    color: colors.onAccent,
  },
  info: {
    ...typography.body,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    minHeight: touchTarget,
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  rowLabelDestructive: {
    color: colors.danger,
  },
  rowHint: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  progressBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  progressText: {
    ...typography.statSmall,
    color: colors.text,
  },
  progressTitle: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  progressTrack: {
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  attribution: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  link: {
    ...typography.caption,
    color: colors.accent,
  },
});
