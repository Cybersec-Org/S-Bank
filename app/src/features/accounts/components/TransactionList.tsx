import { pl } from '@/shared/i18n/pl';
import { formatDayMonth } from '@/shared/lib/dates';
import { formatSignedMoney } from '@/shared/lib/money';
import { Card, ListItem, MoneyText } from '@/shared/ui';

import { signedAmountGrosze, type Transaction } from '../model/account';

interface TransactionListProps {
  readonly transactions: readonly Transaction[];
}

/** The kind line of a row, for example "Przelew przychodzący". */
export function transactionKindLabel(transaction: Transaction): string {
  switch (transaction.kind) {
    case 'qr_payment':
      return pl.transaction.kindQrPayment;
    case 'link_payment':
      return pl.transaction.kindLinkPayment;
    case 'transfer':
      return transaction.direction === 'incoming'
        ? pl.transaction.kindTransferIn
        : pl.transaction.kindTransferOut;
  }
}

/** List of operations inside one card: name, "kind · date" and the signed amount (incoming in green). */
export function TransactionList({ transactions }: TransactionListProps) {
  return (
    <Card padding="none" gap="none">
      {transactions.map((transaction, index) => {
        const signed = signedAmountGrosze(transaction);
        const kind = transactionKindLabel(transaction);
        const date = formatDayMonth(transaction.bookedAt);
        return (
          <ListItem
            key={transaction.id}
            title={transaction.title}
            subtitle={pl.transaction.detail(kind, date)}
            last={index === transactions.length - 1}
            inset
            trailing={<MoneyText grosze={signed} signed tone={signed < 0 ? 'default' : 'accent'} />}
            accessibilityLabel={pl.transaction.rowLabel(
              kind,
              transaction.title,
              formatSignedMoney(signed),
              date,
            )}
          />
        );
      })}
    </Card>
  );
}
