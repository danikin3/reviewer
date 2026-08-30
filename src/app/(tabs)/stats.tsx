import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';

export default function StatsScreen() {
  return (
    <Screen title="Statistik">
      <EmptyState
        icon="bar-chart-outline"
        title="Noch keine Daten"
        hint="Gesehene Filme, Serien und Episoden, Sehdauer und Rating-Verteilung erscheinen hier, sobald du bewertest."
      />
    </Screen>
  );
}
