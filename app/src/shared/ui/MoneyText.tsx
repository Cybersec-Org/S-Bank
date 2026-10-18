import { formatMoney } from '@/shared/lib/money';

import { Text, type TextTone } from './Text';
import type { TypographyKey } from './theme';

interface MoneyTextProps {
  /** Integer amount in minor units (grosze for PLN). */
  readonly grosze: number;
  readonly currency?: string;
  readonly variant?: TypographyKey;
  readonly tone?: TextTone;
  readonly align?: 'left' | 'center' | 'right';
}

export function MoneyText({
  grosze,
  currency,
  variant = 'body',
  tone = 'default',
  align = 'left',
}: MoneyTextProps) {
  return (
    <Text variant={variant} tone={tone} align={align} tabular>
      {currency === undefined ? formatMoney(grosze) : formatMoney(grosze, currency)}
    </Text>
  );
}
