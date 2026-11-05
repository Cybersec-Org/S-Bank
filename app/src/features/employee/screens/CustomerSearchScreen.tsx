import { useRouter } from 'expo-router';
import { useState } from 'react';

import { pl } from '@/shared/i18n/pl';
import {
  AsyncBoundary,
  Box,
  Button,
  Card,
  ListItem,
  Screen,
  Text,
  TextField,
  useTheme,
} from '@/shared/ui';

import { useCustomerSearchQuery } from '../hooks/useEmployee';
import { isSearchLongEnough } from '../model/customer';

/** FR-09: employee searches customers; opening one is a read-only, audited view. */
export function CustomerSearchScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState('');
  const searchQuery = useCustomerSearchQuery(submitted);
  const results = searchQuery.data ?? [];
  const searchActive = isSearchLongEnough(submitted);

  return (
    <Screen width="wide" gutter="gutter">
      <Text variant="pageTitle" accessibilityRole="header">
        {pl.employee.searchTitle}
      </Text>
      <Box direction="row" gap="md" align="flex-end" wrap>
        <TextField
          label={pl.employee.searchLabel}
          hint={pl.employee.searchHint}
          placeholder={pl.employee.searchPlaceholder}
          maxWidth={theme.layout.searchMaxWidth}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => setSubmitted(input)}
          returnKeyType="search"
          autoCapitalize="none"
        />
        <Button label={pl.employee.searchSubmit} size="small" onPress={() => setSubmitted(input)} />
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
          <Card padding="none" gap="none">
            {results.map((customer, index) => (
              <ListItem
                key={customer.id}
                title={customer.displayName}
                subtitle={pl.employee.customerMeta(customer.email, customer.customerNumber)}
                inset
                last={index === results.length - 1}
                accessibilityLabel={pl.employee.openCustomer(customer.displayName)}
                onPress={() =>
                  router.push({
                    pathname: '/customers/[customerId]',
                    params: { customerId: customer.id },
                  })
                }
              />
            ))}
          </Card>
        </AsyncBoundary>
      ) : submitted !== '' ? (
        <Text tone="muted">{pl.employee.searchTooShort}</Text>
      ) : null}
    </Screen>
  );
}
