import { RatesScreen } from '@/features/rates';
import { useGoBack } from '@/shared/navigation/useGoBack';

/** Rates without signing in: the arrow returns to the login screen. */
export default function GuestRatesRoute() {
  const goBack = useGoBack('/');
  return <RatesScreen onBack={goBack} />;
}
