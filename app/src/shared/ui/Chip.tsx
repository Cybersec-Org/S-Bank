import { View } from 'react-native';

import { Icon, type IconName } from './Icon';
import { Text, type TextTone } from './Text';
import { useTheme } from './ThemeProvider';

export type ChipTone = 'soft' | 'outlined' | 'neutral' | 'warning' | 'danger';

interface ChipProps {
  readonly label: string;
  readonly tone?: ChipTone;
  readonly icon?: IconName;
}

/** Small status label: the payment source, the expiry counter, the customer's account status. */
export function Chip({ label, tone = 'soft', icon }: ChipProps) {
  const theme = useTheme();
  const look = {
    soft: {
      background: theme.colors.primarySoft,
      border: theme.colors.primarySoft,
      content: theme.colors.onPrimarySoft,
      text: 'onSoft',
    },
    outlined: {
      background: theme.colors.surface,
      border: theme.colors.border,
      content: theme.colors.text,
      text: 'default',
    },
    neutral: {
      background: theme.colors.neutralChip,
      border: theme.colors.neutralChip,
      content: theme.colors.text,
      text: 'default',
    },
    warning: {
      background: theme.colors.warningBg,
      border: theme.colors.warningBg,
      content: theme.colors.warningText,
      text: 'warning',
    },
    danger: {
      background: theme.colors.dangerBg,
      border: theme.colors.dangerBg,
      content: theme.colors.danger,
      text: 'danger',
    },
  }[tone];
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs + 2,
        borderRadius: theme.radii.pill,
        borderWidth: theme.layout.borderWidth,
        borderColor: look.border,
        backgroundColor: look.background,
      }}
    >
      {icon === undefined ? null : <Icon name={icon} color={look.content} size={16} />}
      <Text variant="label" tone={look.text as TextTone}>
        {label}
      </Text>
    </View>
  );
}
