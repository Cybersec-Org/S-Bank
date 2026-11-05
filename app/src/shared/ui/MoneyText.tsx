import { formatMoney, formatSignedMoney } from '@/shared/lib/money';

import { Text, type TextTone } from './Text';
import type { TypographyKey } from './theme';

interface MoneyTextProps {
  /** Integer amount in minor units (grosze for PLN). */
  readonly grosze: number;
  readonly currency?: string;
  readonly variant?: TypographyKey;
  readonly tone?: TextTone;
  readonly align?: 'left' | 'center' | 'right';
  /** Shows an explicit plus before a positive amount (lists of operations). */
  readonly signed?: boolean;
}

export function MoneyText({
  grosze,
  currency,
  variant = 'body',
  tone = 'default',
  align = 'left',
  signed = false,
}: MoneyTextProps) {
  return (
    <Text variant={variant} tone={tone} align={align} tabular>
      {signed
        ? formatSignedMoney(grosze, currency)
        : currency === undefined
          ? formatMoney(grosze)
          : formatMoney(grosze, currency)}
    </Text>
  );
}
