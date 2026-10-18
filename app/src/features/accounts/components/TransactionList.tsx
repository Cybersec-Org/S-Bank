import { Box, ListItem, MoneyText } from '@/shared/ui';
import { pl } from '@/shared/i18n/pl';
import { formatDate } from '@/shared/lib/dates';
import { formatMoney } from '@/shared/lib/money';

import { signedAmountGrosze, type Transaction } from '../model/account';

interface TransactionListProps {
  readonly transactions: readonly Transaction[];
}

export function TransactionList({ transactions }: TransactionListProps) {
  return (
    <Box>
      {transactions.map((transaction) => {
        const signed = signedAmountGrosze(transaction);
        const kind =
          transaction.direction === 'incoming' ? pl.transaction.incoming : pl.transaction.outgoing;
        return (
          <ListItem
            key={transaction.id}
            title={transaction.title}
            subtitle={`${transaction.counterpartyName} · ${formatDate(transaction.bookedAt)}`}
            trailing={<MoneyText grosze={signed} tone={signed < 0 ? 'default' : 'success'} />}
            accessibilityLabel={pl.transaction.rowLabel(
              kind,
              transaction.title,
              formatMoney(signed),
              formatDate(transaction.bookedAt),
            )}
          />
        );
      })}
    </Box>
  );
}
