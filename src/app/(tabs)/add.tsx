import { MediaSearch } from '@/components/media-search';
import { Screen } from '@/components/screen';

export default function AddScreen() {
  return (
    <Screen title="Bewerten">
      <MediaSearch
        target="rate"
        idleTitle="Was hast du gesehen?"
        idleHint="Such den Film oder die Serie — beim Antippen geht es direkt zur Bewertung."
      />
    </Screen>
  );
}
