import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';

const ICON_DISC_SIZE = 56;

interface StepUpPanelProps {
  readonly title: string;
  readonly children: ReactNode;
}

/** Warning panel of the confirmation screens: tells the user a passkey confirmation is required. */
export function StepUpPanel({ title, children }: StepUpPanelProps) {
  const theme = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: theme.colors.warningBg,
        borderRadius: theme.radii.lg,
        padding: theme.spacing.lg,
        alignItems: 'center',
        gap: theme.spacing.md,
      }}
    >
      <View
        style={{
          width: ICON_DISC_SIZE,
          height: ICON_DISC_SIZE,
          borderRadius: theme.radii.pill,
          backgroundColor: theme.colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="key" color={theme.colors.warningText} size={28} />
      </View>
      <Text variant="heading" tone="warning" align="center">
        {title}
      </Text>
      {typeof children === 'string' ? (
        <Text tone="warning" align="center">
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}
