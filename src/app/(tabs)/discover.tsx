import { MediaSearch } from '@/components/media-search';
import { Screen } from '@/components/screen';

export default function DiscoverScreen() {
  return (
    <Screen title="Discover">
      <MediaSearch
        target="detail"
        idleTitle="Wonach suchst du?"
        idleHint="Filme und Serien erscheinen gemeinsam in einem Ergebnis-Feed."
      />
    </Screen>
  );
}
