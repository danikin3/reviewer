import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { profileUrl } from '@/api/tmdb/images';
import { colors, radius, spacing, typography } from '@/theme/theme';
import type { WatchAvailability, WatchProvider } from '@/types/media';

function ProviderRow({ label, providers }: { label: string; providers: WatchProvider[] }) {
  if (providers.length === 0) return null;
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.logos}>
        {providers.map((provider) => {
          const url = profileUrl(provider.logoPath);
          return url ? (
            <Image
              key={provider.providerId}
              source={{ uri: url }}
              style={styles.logo}
              contentFit="contain"
              accessibilityLabel={provider.name}
            />
          ) : (
            <View key={provider.providerId} style={[styles.logo, styles.logoFallback]}>
              <Text style={styles.logoText} numberOfLines={1}>
                {provider.name.slice(0, 2)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * Streaming-Verfügbarkeit, gruppiert nach Abo / Leihen / Kaufen.
 *
 * Bewusst ohne Preise — TMDB liefert über JustWatch nur, *wo* ein Titel
 * verfügbar ist, nicht zu welchem Preis. Statt erfundener Zahlen führt der
 * Link auf die TMDB-Watch-Seite. Die JustWatch-Attribution ist Bedingung
 * für die Nutzung dieser Daten.
 */
export function WatchProviders({ availability }: { availability: WatchAvailability }) {
  return (
    <View style={styles.root}>
      <ProviderRow label="Im Abo" providers={availability.flatrate} />
      <ProviderRow label="Leihen" providers={availability.rent} />
      <ProviderRow label="Kaufen" providers={availability.buy} />

      {availability.link && (
        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(availability.link ?? '')}
          accessibilityRole="link"
          accessibilityLabel="Alle Anbieter und Preise bei TMDB ansehen"
        >
          <Text style={styles.link}>Alle Anbieter bei TMDB ansehen</Text>
        </Pressable>
      )}

      <Text style={styles.attribution}>
        Verfügbarkeitsdaten von JustWatch, bereitgestellt über TMDB. Keine Preisangaben.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.md,
  },
  group: {
    gap: spacing.sm,
  },
  groupLabel: {
    ...typography.label,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  logos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  logoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  link: {
    ...typography.caption,
    color: colors.accent,
  },
  attribution: {
    ...typography.caption,
    color: colors.textTertiary,
    fontSize: 11,
  },
});
