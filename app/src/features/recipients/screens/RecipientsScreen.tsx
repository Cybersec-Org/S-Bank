import { useState } from 'react';

import { pl } from '@/shared/i18n/pl';
import { useGoBack } from '@/shared/navigation/useGoBack';
import { maskIban } from '@/shared/lib/iban';
import { AsyncBoundary, Box, Button, ListItem, Screen, Text } from '@/shared/ui';

import { RecipientForm } from '../components/RecipientForm';
import {
  useDeleteRecipientMutation,
  useSaveRecipientMutation,
} from '../hooks/useRecipientMutations';
import { useRecipientsQuery } from '../hooks/useRecipientsQuery';
import type { Recipient, RecipientInput } from '../model/recipient';

type FormState =
  { readonly mode: 'closed' } | { readonly mode: 'open'; readonly editing: Recipient | null };

/** FR-06: list, add, edit and delete saved recipients. */
export function RecipientsScreen() {
  const goBack = useGoBack('/dashboard');
  const recipientsQuery = useRecipientsQuery();
  const saveMutation = useSaveRecipientMutation();
  const deleteMutation = useDeleteRecipientMutation();
  const [form, setForm] = useState<FormState>({ mode: 'closed' });
  const recipients = recipientsQuery.data ?? [];

  function closeForm(): void {
    saveMutation.reset();
    setForm({ mode: 'closed' });
  }

  function handleSubmit(input: RecipientInput): void {
    if (form.mode !== 'open') {
      return;
    }
    saveMutation.mutate({ id: form.editing?.id ?? null, input }, { onSuccess: closeForm });
  }

  return (
    <Screen title={pl.recipients.title}>
      <Button label={pl.common.back} variant="secondary" onPress={goBack} />
      <Text tone="muted">{pl.recipients.intro}</Text>

      {form.mode === 'open' ? (
        <RecipientForm
          key={form.editing?.id ?? 'new'}
          editing={form.editing}
          pending={saveMutation.isPending}
          submitError={saveMutation.error}
          onSubmit={handleSubmit}
          onCancel={closeForm}
        />
      ) : (
        <Button
          label={pl.recipients.add}
          onPress={() => setForm({ mode: 'open', editing: null })}
        />
      )}

      <AsyncBoundary
        isLoading={recipientsQuery.isPending}
        error={recipientsQuery.error}
        isEmpty={recipients.length === 0}
        onRetry={() => void recipientsQuery.refetch()}
        emptyTitle={pl.recipients.emptyTitle}
        emptyMessage={pl.recipients.emptyMessage}
      >
        <Box>
          {recipients.map((recipient) => (
            <ListItem
              key={recipient.id}
              title={recipient.name}
              subtitle={maskIban(recipient.iban)}
              trailing={
                <Box direction="row" gap="xs">
                  <Button
                    label={pl.common.edit}
                    variant="secondary"
                    accessibilityLabel={pl.recipients.editLabel(recipient.name)}
                    onPress={() => setForm({ mode: 'open', editing: recipient })}
                  />
                  <Button
                    label={pl.common.delete}
                    variant="destructive"
                    accessibilityLabel={pl.recipients.deleteLabel(recipient.name)}
                    loading={deleteMutation.isPending && deleteMutation.variables === recipient.id}
                    onPress={() => deleteMutation.mutate(recipient.id)}
                  />
                </Box>
              }
            />
          ))}
        </Box>
      </AsyncBoundary>
    </Screen>
  );
}
