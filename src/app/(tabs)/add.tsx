import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';

export default function AddScreen() {
  return (
    <Screen title="Bewerten">
      <EmptyState
        icon="star-outline"
        title="Titel suchen und bewerten"
        hint="Hier entsteht das Bewertungs-Sheet: Titel suchen, Sterne vergeben, Review schreiben."
      />
    </Screen>
  );
}
