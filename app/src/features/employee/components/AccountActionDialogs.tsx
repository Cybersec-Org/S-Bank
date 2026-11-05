import { useState } from 'react';

import { pl } from '@/shared/i18n/pl';
import { formatMoney } from '@/shared/lib/money';
import { Box, ConfirmDialog, Text, TextField } from '@/shared/ui';

import { MAX_DAILY_LIMIT_GROSZE, MIN_DAILY_LIMIT_GROSZE, parseDailyLimit } from '../model/customer';

interface LimitDialogProps {
  readonly visible: boolean;
  readonly currentLimitGrosze: number;
  readonly pending: boolean;
  readonly onSave: (limitGrosze: number) => void;
  readonly onCancel: () => void;
}

/** Window for changing the daily limit. It mirrors the permitted range; the API enforces it again. */
export function LimitDialog({
  visible,
  currentLimitGrosze,
  pending,
  onSave,
  onCancel,
}: LimitDialogProps) {
  const [input, setInput] = useState('');
  const [showError, setShowError] = useState(false);

  function handleConfirm(): void {
    const limit = parseDailyLimit(input);
    if (limit === null) {
      setShowError(true);
      return;
    }
    setShowError(false);
    onSave(limit);
  }

  function handleCancel(): void {
    setShowError(false);
    setInput('');
    onCancel();
  }

  return (
    <ConfirmDialog
      visible={visible}
      title={pl.employee.limitDialogTitle}
      confirmLabel={pl.employee.limitSave}
      pending={pending}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    >
      <Box gap="xs">
        <Text tone="muted">{pl.employee.limitCurrent(formatMoney(currentLimitGrosze))}</Text>
        <Text variant="caption" tone="muted">
          {pl.employee.limitRange(
            formatMoney(MIN_DAILY_LIMIT_GROSZE),
            formatMoney(MAX_DAILY_LIMIT_GROSZE),
          )}
        </Text>
      </Box>
      <TextField
        label={pl.employee.limitInputLabel}
        value={input}
        onChangeText={setInput}
        error={showError ? pl.employee.limitInvalid : undefined}
        keyboardType="decimal-pad"
      />
    </ConfirmDialog>
  );
}

interface BlockDialogProps {
  readonly visible: boolean;
  /** True when the account is blocked now, so the dialog offers to unblock it. */
  readonly blocked: boolean;
  readonly pending: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function BlockDialog({ visible, blocked, pending, onConfirm, onCancel }: BlockDialogProps) {
  return (
    <ConfirmDialog
      visible={visible}
      title={blocked ? pl.employee.unblockDialogTitle : pl.employee.blockDialogTitle}
      message={blocked ? pl.employee.unblockDialogMessage : pl.employee.blockDialogMessage}
      confirmLabel={blocked ? pl.employee.unblock : pl.employee.block}
      destructive={!blocked}
      pending={pending}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
