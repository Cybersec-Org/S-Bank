import { RatesScreen } from '@/features/rates';

import { useAccountsQuery } from '../hooks/useAccountsQuery';

/** Rates inside the customer's bottom navigation; the converter starts with the main account's balance. */
export function CustomerRatesScreen() {
  const accountsQuery = useAccountsQuery();
  const balance = accountsQuery.data?.[0]?.balanceGrosze ?? null;
  return <RatesScreen defaultAmountGrosze={balance} />;
}
