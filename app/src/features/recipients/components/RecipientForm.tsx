import { useState } from 'react';

import { describeProblem } from '@/shared/api/problem';
import { pl } from '@/shared/i18n/pl';
import { Banner, Box, Button, Card, Text, TextField } from '@/shared/ui';

import {
  toNormalizedRecipientInput,
  validateRecipientInput,
  type Recipient,
  type RecipientFormError,
  type RecipientInput,
} from '../model/recipient';

interface RecipientFormProps {
  /** The recipient being edited, or null for a new one. */
  readonly editing: Recipient | null;
  readonly pending: boolean;
  readonly submitError: unknown;
  readonly onSubmit: (input: RecipientInput) => void;
  readonly onCancel: () => void;
}

export function RecipientForm({
  editing,
  pending,
  submitError,
  onSubmit,
  onCancel,
}: RecipientFormProps) {
  const [name, setName] = useState(editing?.name ?? '');
  const [iban, setIban] = useState(editing?.iban ?? '');
  const [errors, setErrors] = useState<readonly RecipientFormError[]>([]);

  function handleSubmit(): void {
    const found = validateRecipientInput({ name, iban });
    setErrors(found);
    if (found.length === 0) {
      onSubmit(toNormalizedRecipientInput({ name, iban }));
    }
  }

  return (
    <Card gap="md">
      <Text variant="heading">
        {editing === null ? pl.recipients.addHeading : pl.recipients.editHeading}
      </Text>
      <TextField
        label={pl.recipients.nameLabel}
        value={name}
        onChangeText={setName}
        error={errors.includes('nameRequired') ? pl.recipients.errorNameRequired : undefined}
        autoCapitalize="words"
      />
      <TextField
        label={pl.recipients.ibanLabel}
        value={iban}
        onChangeText={setIban}
        error={errors.includes('ibanInvalid') ? pl.recipients.errorIbanInvalid : undefined}
        autoCapitalize="characters"
      />
      {submitError === null || submitError === undefined ? null : (
        <Banner tone="danger">{describeProblem(submitError)}</Banner>
      )}
      <Box direction="row" gap="sm" wrap>
        <Button
          label={editing === null ? pl.recipients.add : pl.recipients.saveChanges}
          onPress={handleSubmit}
          loading={pending}
        />
        <Button
          label={pl.common.cancel}
          onPress={onCancel}
          variant="secondary"
          disabled={pending}
        />
      </Box>
    </Card>
  );
}
