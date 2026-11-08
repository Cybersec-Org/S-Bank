import type { ReactNode } from 'react';
import { Modal, View } from 'react-native';

import { pl } from '@/shared/i18n/pl';
import { Box } from './Box';
import { Button } from './Button';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';

interface ConfirmDialogProps {
  readonly visible: boolean;
  readonly title: string;
  readonly message?: string;
  /** Extra content such as an amount field. */
  readonly children?: ReactNode;
  readonly confirmLabel: string;
  readonly destructive?: boolean;
  readonly pending?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** Modal window that asks the user to confirm a consequential action (limit change, blocking). */
export function ConfirmDialog({
  visible,
  title,
  message,
  children,
  confirmLabel,
  destructive = false,
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const theme = useTheme();
  return (
    <Modal
      statusBarTranslucent
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: theme.spacing.gutter,
          backgroundColor: theme.colors.scrim,
        }}
      >
        <View
          aria-modal
          style={{
            width: '100%',
            maxWidth: theme.layout.contentMaxWidthNarrow,
            gap: theme.spacing.lg,
            padding: theme.spacing.xl,
            borderRadius: theme.radii.xl,
            backgroundColor: theme.colors.surface,
          }}
        >
          <Text variant="screenTitle">{title}</Text>
          {message === undefined ? null : <Text tone="muted">{message}</Text>}
          {children}
          <Box direction="row" gap="sm" wrap justify="flex-end">
            <Button label={pl.common.cancel} variant="secondary" size="small" onPress={onCancel} />
            <Button
              label={confirmLabel}
              variant={destructive ? 'destructive' : 'primary'}
              size="small"
              loading={pending}
              onPress={onConfirm}
            />
          </Box>
        </View>
      </View>
    </Modal>
  );
}
