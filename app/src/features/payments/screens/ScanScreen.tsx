import { useRouter } from 'expo-router';
import { useState } from 'react';

import { pl } from '@/shared/i18n/pl';
import { useGoBack } from '@/shared/navigation/useGoBack';
import { isUuid } from '@/shared/lib/ids';
import { Banner, Box, Button, PlaceholderBlock, Screen, Text, TextField } from '@/shared/ui';

/**
 * FR-07: the camera scanner arrives with B-23. Until then a request id can be entered by hand, which
 * exercises the same path as a scanned code: only an id is accepted, details come from the API.
 */
export function ScanScreen() {
  const router = useRouter();
  const goBack = useGoBack('/dashboard');
  const [requestId, setRequestId] = useState('');
  const [showError, setShowError] = useState(false);

  function handleSubmit(): void {
    const candidate = requestId.trim();
    if (!isUuid(candidate)) {
      setShowError(true);
      return;
    }
    setShowError(false);
    router.push({ pathname: '/pay/[requestId]', params: { requestId: candidate } });
  }

  return (
    <Screen title={pl.scan.title}>
      <Button label={pl.common.back} variant="secondary" onPress={goBack} />
      <PlaceholderBlock label={pl.scan.scannerPlaceholder} />
      <Banner tone="info">{pl.scan.cameraRationale}</Banner>
      <Box gap="md">
        <Text variant="heading">{pl.scan.manualHeading}</Text>
        <TextField
          label={pl.scan.manualLabel}
          hint={pl.scan.manualHint}
          value={requestId}
          onChangeText={setRequestId}
          error={showError ? pl.scan.manualInvalid : undefined}
          autoCapitalize="none"
        />
        <Button label={pl.scan.manualSubmit} onPress={handleSubmit} />
      </Box>
    </Screen>
  );
}
