import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TextInput, View } from 'react-native';

import { describeTmdbError, hasApiKey } from '@/api/tmdb/client';
import { searchMulti } from '@/api/tmdb/tmdb';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { SearchResultRow } from '@/components/search-result-row';
import { useDebounced } from '@/hooks/use-debounced';
import { colors, radius, spacing, touchTarget, typography } from '@/theme/theme';
import type { SearchHit } from '@/types/media';

type SearchState =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'error'; message: string }
  | { kind: 'results'; hits: SearchHit[] };

export default function DiscoverScreen() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, 350);
  const [state, setState] = useState<SearchState>({ kind: 'idle' });
  const keyMissing = !hasApiKey();

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed.length === 0) {
      setState({ kind: 'idle' });
      return;
    }

    let cancelled = false;
    setState({ kind: 'searching' });

    searchMulti(trimmed)
      .then((hits) => {
        if (!cancelled) setState({ kind: 'results', hits });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ kind: 'error', message: describeTmdbError(error) });
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  return (
    <Screen title="Discover">
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Filme und Serien suchen"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Suchfeld für Filme und Serien"
        />
        {query.length > 0 && (
          <Ionicons
            name="close-circle"
            size={18}
            color={colors.textTertiary}
            onPress={() => setQuery('')}
            accessibilityLabel="Suche leeren"
          />
        )}
      </View>

      {keyMissing && state.kind === 'idle' && (
        <EmptyState
          icon="key-outline"
          title="Kein TMDB-Schlüssel hinterlegt"
          hint="Trage EXPO_PUBLIC_TMDB_API_KEY in die .env ein, dann funktioniert die Suche."
        />
      )}

      {!keyMissing && state.kind === 'idle' && (
        <EmptyState
          icon="compass-outline"
          title="Wonach suchst du?"
          hint="Filme und Serien erscheinen gemeinsam in einem Ergebnis-Feed."
        />
      )}

      {state.kind === 'searching' && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}

      {state.kind === 'error' && (
        <EmptyState icon="cloud-offline-outline" title="Suche fehlgeschlagen" hint={state.message} />
      )}

      {state.kind === 'results' && state.hits.length === 0 && (
        <EmptyState
          icon="search-outline"
          title="Nichts gefunden"
          hint={`Für „${debouncedQuery.trim()}" gibt es bei TMDB keine Treffer.`}
        />
      )}

      {state.kind === 'results' && state.hits.length > 0 && (
        <FlatList
          data={state.hits}
          keyExtractor={(hit) => `${hit.mediaType}-${hit.tmdbId}`}
          renderItem={({ item }) => <SearchResultRow hit={item} />}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: touchTarget,
    marginBottom: spacing.lg,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    height: '100%',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
