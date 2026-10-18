import { useState } from 'react';

import { pl } from '@/shared/i18n/pl';
import { formatMoney } from '@/shared/lib/money';
import { Box, Button, Text, TextField } from '@/shared/ui';

import { MAX_DAILY_LIMIT_GROSZE, MIN_DAILY_LIMIT_GROSZE, parseDailyLimit } from '../model/customer';

interface DailyLimitFormProps {
  readonly currentLimitGrosze: number;
  readonly pending: boolean;
  readonly onSave: (limitGrosze: number) => void;
}

/** Mirrors the permitted range for instant feedback; the API enforces it again. */
export function DailyLimitForm({ currentLimitGrosze, pending, onSave }: DailyLimitFormProps) {
  const [input, setInput] = useState('');
  const [showError, setShowError] = useState(false);

  function handleSave(): void {
    const limit = parseDailyLimit(input);
    if (limit === null) {
      setShowError(true);
      return;
    }
    setShowError(false);
    onSave(limit);
  }

  return (
    <Box gap="sm">
      <Text variant="label">{pl.employee.limitHeading}</Text>
      <Text tone="muted">{pl.employee.limitCurrent(formatMoney(currentLimitGrosze))}</Text>
      <Text variant="caption" tone="muted">
        {pl.employee.limitRange(
          formatMoney(MIN_DAILY_LIMIT_GROSZE),
          formatMoney(MAX_DAILY_LIMIT_GROSZE),
        )}
      </Text>
      <TextField
        label={pl.employee.limitInputLabel}
        value={input}
        onChangeText={setInput}
        error={showError ? pl.employee.limitInvalid : undefined}
        keyboardType="decimal-pad"
      />
      <Button label={pl.employee.limitChange} onPress={handleSave} loading={pending} />
    </Box>
  );
}
