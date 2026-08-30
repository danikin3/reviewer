import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, TextInput, View } from 'react-native';

import { describeTmdbError, hasApiKey } from '@/api/tmdb/client';
import { searchMulti } from '@/api/tmdb/tmdb';
import { EmptyState } from '@/components/empty-state';
import { SearchResultRow } from '@/components/search-result-row';
import { useDebounced } from '@/hooks/use-debounced';
import { colors, radius, spacing, touchTarget, typography } from '@/theme/theme';
import type { SearchHit } from '@/types/media';

type SearchState =
  | { kind: 'idle' }
  | { kind: 'searching' }
  | { kind: 'error'; message: string }
  | { kind: 'results'; hits: SearchHit[] };

/** Suchergebnis samt der Anfrage, zu der es gehört. */
type SearchResult =
  | { query: string; kind: 'results'; hits: SearchHit[] }
  | { query: string; kind: 'error'; message: string };

type MediaSearchProps = {
  /** Ziel beim Antippen eines Treffers */
  target: 'detail' | 'rate';
  idleTitle: string;
  idleHint: string;
  /**
   * Was bei leerem Suchfeld steht. Ohne diese Angabe erscheint ein
   * Leerzustand aus `idleTitle`/`idleHint`; Discover schiebt hier
   * stattdessen Trending und Empfehlungen hinein.
   */
  renderIdle?: () => React.ReactNode;
};

/** Suchfeld über Filme und Serien samt aller Lade-, Leer- und Fehlerzustände. */
export function MediaSearch({ target, idleTitle, idleHint, renderIdle }: MediaSearchProps) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounced(query, 350);
  /** Trägt die Suchanfrage mit, zu der es gehört — siehe `state` unten. */
  const [result, setResult] = useState<SearchResult | null>(null);
  const keyMissing = !hasApiKey();

  const trimmedQuery = debouncedQuery.trim();

  /**
   * Der Anzeigezustand wird beim Render abgeleitet statt per setState gesetzt.
   * Leeres Feld heißt "idle", eine Anfrage ohne passendes Ergebnis heißt
   * "wird gesucht" — so bleiben beim Weitertippen nie alte Treffer stehen.
   */
  const state: SearchState =
    trimmedQuery.length === 0
      ? { kind: 'idle' }
      : result === null || result.query !== trimmedQuery
        ? { kind: 'searching' }
        : result.kind === 'results'
          ? { kind: 'results', hits: result.hits }
          : { kind: 'error', message: result.message };

  useEffect(() => {
    if (trimmedQuery.length === 0) return;
    let cancelled = false;

    searchMulti(trimmedQuery)
      .then((hits) => {
        if (!cancelled) setResult({ query: trimmedQuery, kind: 'results', hits });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResult({ query: trimmedQuery, kind: 'error', message: describeTmdbError(error) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [trimmedQuery]);

  return (
    <>
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

      {state.kind === 'idle' && renderIdle !== undefined && renderIdle()}

      {state.kind === 'idle' && renderIdle === undefined && keyMissing && (
        <EmptyState
          icon="key-outline"
          title="Kein TMDB-Schlüssel hinterlegt"
          hint="Trage EXPO_PUBLIC_TMDB_API_KEY in die .env ein, dann funktioniert die Suche."
        />
      )}

      {state.kind === 'idle' && renderIdle === undefined && !keyMissing && (
        <EmptyState icon="search-outline" title={idleTitle} hint={idleHint} />
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
          hint={`Für „${trimmedQuery}" gibt es bei TMDB keine Treffer.`}
        />
      )}

      {state.kind === 'results' && state.hits.length > 0 && (
        <FlatList
          data={state.hits}
          keyExtractor={(hit) => `${hit.mediaType}-${hit.tmdbId}`}
          renderItem={({ item }) => <SearchResultRow hit={item} target={target} />}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </>
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
