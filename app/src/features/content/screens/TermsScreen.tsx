import { pl } from '@/shared/i18n/pl';
import { PlaceholderBlock, Screen } from '@/shared/ui';

/** SR-12: the terms will be shown in a locked-down WebView (B-30); until then a placeholder. */
export function TermsScreen() {
  return (
    <Screen>
      <PlaceholderBlock label={pl.terms.placeholder} />
    </Screen>
  );
}
