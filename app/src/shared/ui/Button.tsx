import { ActivityIndicator, Pressable } from 'react-native';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive';

interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  /** Defaults to the visible label; override when the label alone is ambiguous in a list. */
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly accessibilityRole?: 'button' | 'link';
  readonly fullWidth?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  fullWidth = false,
}: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const filled = variant !== 'secondary';
  const background = variant === 'destructive' ? theme.colors.danger : theme.colors.accent;
  const textColorTone = filled ? 'inverse' : 'accent';
  const borderColor = variant === 'destructive' ? theme.colors.danger : theme.colors.accent;

  return (
    <Pressable
      disabled={inactive}
      onPress={() => {
        if (!inactive) {
          onPress();
        }
      }}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      {...(accessibilityHint === undefined ? {} : { accessibilityHint })}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed, focused }: { pressed: boolean; focused?: boolean }) => ({
        minHeight: theme.minTouchTarget,
        minWidth: theme.minTouchTarget,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radii.md,
        borderWidth: theme.layout.borderWidth,
        borderColor: focused ? theme.colors.focusRing : borderColor,
        backgroundColor: filled ? background : theme.colors.surface,
        opacity: inactive ? 0.5 : pressed ? 0.8 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
      })}
    >
      {loading ? (
        <ActivityIndicator color={filled ? theme.colors.textOnAccent : theme.colors.accent} />
      ) : null}
      <Text variant="label" tone={textColorTone} align="center">
        {label}
      </Text>
    </Pressable>
  );
}
