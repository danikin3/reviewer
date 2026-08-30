import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { checkForUpdate, type UpdateInfo } from '@/data/update-check';
import { colors, radius, spacing, touchTarget, typography } from '@/theme/theme';

/**
 * Dezenter Hinweis auf eine neue Version. Erscheint nur, wenn GitHub
 * tatsächlich ein neueres Release kennt, und lässt sich wegtippen.
 */
export function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const version = Constants.expoConfig?.version ?? '0.0.0';

    checkForUpdate(version).then((info) => {
      if (!cancelled) setUpdate(info);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (update === null || dismissed) return null;

  return (
    <View style={styles.root}>
      <Ionicons name="arrow-down-circle-outline" size={18} color={colors.accent} />
      <Pressable
        style={styles.textArea}
        onPress={() => WebBrowser.openBrowserAsync(update.url)}
        accessibilityRole="link"
        accessibilityLabel={`Version ${update.version} herunterladen`}
      >
        <Text style={styles.text}>
          Version {update.version} ist verfügbar — antippen zum Herunterladen
        </Text>
      </Pressable>
      <Pressable
        onPress={() => setDismissed(true)}
        style={styles.close}
        accessibilityRole="button"
        accessibilityLabel="Hinweis ausblenden"
      >
        <Ionicons name="close" size={16} color={colors.textTertiary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  textArea: {
    flex: 1,
    justifyContent: 'center',
    minHeight: touchTarget - spacing.lg,
  },
  text: {
    ...typography.caption,
    color: colors.text,
  },
  close: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
