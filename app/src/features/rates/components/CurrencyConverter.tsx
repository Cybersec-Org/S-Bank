import { useState } from 'react';
import { View } from 'react-native';

import { pl } from '@/shared/i18n/pl';
import { formatAmountInput, formatMoney, parseAmountToGrosze } from '@/shared/lib/money';
import { Card, SelectField, Text, TextField, useTheme } from '@/shared/ui';

import { convertPlnToForeign, type Rate } from '../model/rate';

interface CurrencyConverterProps {
  readonly rates: readonly Rate[];
  /** Amount the field starts with (the signed-in customer's balance); empty for guests. */
  readonly defaultAmountGrosze?: number | null;
}

/** FR-08: converts an amount in zloty at the NBP mid rate. */
export function CurrencyConverter({ rates, defaultAmountGrosze = null }: CurrencyConverterProps) {
  const theme = useTheme();
  const [amount, setAmount] = useState(
    defaultAmountGrosze === null ? '' : formatAmountInput(defaultAmountGrosze),
  );
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const rate = rates.find((candidate) => candidate.code === selectedCode) ?? rates[0];
  const grosze = parseAmountToGrosze(amount);
  const showError = amount.trim() !== '' && grosze === null;

  if (rate === undefined) {
    return null;
  }
  const result = grosze === null ? null : formatMoney(convertPlnToForeign(grosze, rate), rate.code);
  return (
    <Card gap="md" radius="large">
      <Text variant="heading">{pl.rates.converterHeading}</Text>
      <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start' }}>
        <View style={{ flex: 3, minWidth: 0 }}>
          <TextField
            label={pl.rates.amountLabel}
            hint={pl.rates.amountHint}
            value={amount}
            onChangeText={setAmount}
            error={showError ? pl.rates.amountInvalid : undefined}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={{ flex: 2, minWidth: 0 }}>
          <SelectField
            label={pl.rates.currencyLabel}
            sheetTitle={pl.rates.currencySheetTitle}
            value={rate.code}
            displayValue={rate.code}
            onChange={setSelectedCode}
            options={rates.map((candidate) => ({
              value: candidate.code,
              label: pl.rates.currencyOption(candidate.code, candidate.name),
            }))}
          />
        </View>
      </View>
      <View
        style={{
          gap: theme.spacing.xs,
          paddingTop: theme.spacing.md,
          borderTopWidth: theme.layout.borderWidth,
          borderTopColor: theme.colors.divider,
        }}
        accessibilityLiveRegion="polite"
      >
        <Text variant="label" tone="muted">
          {pl.rates.resultLabel}
        </Text>
        {result === null ? null : (
          <Text
            variant="amountInput"
            tone="accent"
            tabular
            accessibilityLabel={pl.rates.resultAccessible(result)}
          >
            {result}
          </Text>
        )}
      </View>
    </Card>
  );
}
