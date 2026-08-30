import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';

export default function ProfileScreen() {
  return (
    <Screen title="Profil">
      <EmptyState
        icon="person-outline"
        title="Dein Profil"
        hint="Poster-Grid deiner bewerteten Titel, Watchlist, Listen und Einstellungen kommen hierher."
      />
    </Screen>
  );
}
