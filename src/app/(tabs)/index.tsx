import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';

export default function HomeScreen() {
  return (
    <Screen title="Reviewer">
      <EmptyState
        icon="film-outline"
        title="Noch keine Aktivität"
        hint="Bewerte deinen ersten Film oder deine erste Serie über den Add-Button — dein Tagebuch erscheint hier."
      />
    </Screen>
  );
}
