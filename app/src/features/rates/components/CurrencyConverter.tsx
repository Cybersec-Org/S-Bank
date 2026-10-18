import { useState } from 'react';

import { pl } from '@/shared/i18n/pl';
import { formatMoney, parseAmountToGrosze } from '@/shared/lib/money';
import { Box, Card, ChoiceGroup, Text, TextField } from '@/shared/ui';

import { convertPlnToForeign, type Rate } from '../model/rate';

interface CurrencyConverterProps {
  readonly rates: readonly Rate[];
}

/** FR-08: converts an amount in zloty at the NBP mid rate. */
export function CurrencyConverter({ rates }: CurrencyConverterProps) {
  const [amount, setAmount] = useState('');
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const rate = rates.find((candidate) => candidate.code === selectedCode) ?? rates[0];
  const grosze = parseAmountToGrosze(amount);
  const showError = amount.trim() !== '' && grosze === null;

  if (rate === undefined) {
    return null;
  }
  return (
    <Card gap="md">
      <Text variant="heading">{pl.rates.converterHeading}</Text>
      <TextField
        label={pl.rates.amountLabel}
        hint={pl.rates.amountHint}
        value={amount}
        onChangeText={setAmount}
        error={showError ? pl.rates.amountInvalid : undefined}
        keyboardType="decimal-pad"
      />
      <ChoiceGroup
        label={pl.rates.currencyLabel}
        value={rate.code}
        onChange={setSelectedCode}
        options={rates.map((candidate) => ({ value: candidate.code, label: candidate.code }))}
      />
      {grosze === null ? null : (
        <Box accessibilityLiveRegion="polite">
          <Text variant="heading" tabular>
            {pl.rates.result(formatMoney(convertPlnToForeign(grosze, rate), rate.code))}
          </Text>
        </Box>
      )}
    </Card>
  );
}
