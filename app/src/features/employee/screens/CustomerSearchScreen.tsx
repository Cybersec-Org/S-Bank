import { useRouter } from 'expo-router';
import { useState } from 'react';

import { pl } from '@/shared/i18n/pl';
import { AsyncBoundary, Box, Button, ListItem, Screen, Text, TextField } from '@/shared/ui';

import { useCustomerSearchQuery } from '../hooks/useEmployee';
import { isSearchLongEnough } from '../model/customer';

/** FR-09: employee searches customers; opening one is a read-only, audited view. */
export function CustomerSearchScreen() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState('');
  const searchQuery = useCustomerSearchQuery(submitted);
  const results = searchQuery.data ?? [];
  const searchActive = isSearchLongEnough(submitted);

  return (
    <Screen width="wide">
      <Box gap="md">
        <TextField
          label={pl.employee.searchLabel}
          hint={pl.employee.searchHint}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => setSubmitted(input)}
          returnKeyType="search"
          autoCapitalize="none"
        />
        <Button label={pl.employee.searchSubmit} onPress={() => setSubmitted(input)} />
      </Box>

      {searchActive ? (
        <AsyncBoundary
          isLoading={searchQuery.isPending}
          error={searchQuery.error}
          isEmpty={results.length === 0}
          onRetry={() => void searchQuery.refetch()}
          emptyTitle={pl.employee.resultsEmptyTitle}
          emptyMessage={pl.employee.resultsEmptyMessage}
        >
          <Box>
            {results.map((customer) => (
              <ListItem
                key={customer.id}
                title={customer.displayName}
                subtitle={customer.email}
                accessibilityLabel={pl.employee.openCustomer(customer.displayName)}
                onPress={() =>
                  router.push({
                    pathname: '/customers/[customerId]',
                    params: { customerId: customer.id },
                  })
                }
              />
            ))}
          </Box>
        </AsyncBoundary>
      ) : submitted !== '' ? (
        <Text tone="muted">{pl.employee.searchTooShort}</Text>
      ) : null}
    </Screen>
  );
}
