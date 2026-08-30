import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { PosterSize, posterUrl } from '@/api/tmdb/images';
import { colors, radius } from '@/theme/theme';

type PosterProps = {
  path: string | null;
  width: number;
  /** Detailseiten laden eine höhere Auflösung als Listen. */
  size?: 'list' | 'detail';
};

/** Poster im Kinoformat 2:3. Fällt auf einen dezenten Platzhalter zurück. */
export function Poster({ path, width, size = 'list' }: PosterProps) {
  const height = Math.round((width * 3) / 2);
  const url = posterUrl(path, size === 'detail' ? PosterSize.detail : PosterSize.list);

  if (!url) {
    return (
      <View style={[styles.placeholder, { width, height }]}>
        <Ionicons name="image-outline" size={width / 3} color={colors.textTertiary} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: url }}
      style={{ width, height, borderRadius: radius.md, backgroundColor: colors.surface }}
      contentFit="cover"
      transition={150}
      cachePolicy="disk"
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
