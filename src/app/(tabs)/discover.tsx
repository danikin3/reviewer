import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';

export default function DiscoverScreen() {
  return (
    <Screen title="Discover">
      <EmptyState
        icon="compass-outline"
        title="Suche & Trending"
        hint="Hier findest du bald die Suche über Filme und Serien, Trending-Titel und persönliche Empfehlungen."
      />
    </Screen>
  );
}
