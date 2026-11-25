import { ActivityIndicator, Pressable } from 'react-native';

import { Icon, type IconName } from './Icon';
import { Text, type TextTone } from './Text';
import { useTheme } from './ThemeProvider';
import type { ColorTokens } from './theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'link';
export type ButtonSize = 'large' | 'medium' | 'small';

interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  /**
   * `primary` is the filled main action, `secondary` a white button with a strong border, `outline` a
   * border in the brand colour, `destructive` a white button in the danger colour, `ghost` has no box and muted text, `link` has
   * no box and brand-coloured text.
   */
  readonly variant?: ButtonVariant;
  /** `large` is 56 px (main action), `medium` 52 px, `small` 48 px (secondary and table actions). */
  readonly size?: ButtonSize;
  readonly icon?: IconName | undefined;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  /** Defaults to the visible label; override when the label alone is ambiguous in a list. */
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
  readonly accessibilityRole?: 'button' | 'link';
  readonly fullWidth?: boolean;
}

interface VariantLook {
  readonly background: string;
  readonly pressedBackground: string;
  readonly border: string;
  readonly content: string;
  readonly tone: TextTone;
}

function lookFor(variant: ButtonVariant, colors: ColorTokens): VariantLook {
  switch (variant) {
    case 'primary':
      return {
        background: colors.primary,
        pressedBackground: colors.primaryPressed,
        border: colors.primary,
        content: colors.onPrimary,
        tone: 'inverse',
      };
    case 'secondary':
      return {
        background: colors.surface,
        pressedBackground: colors.neutralChip,
        border: colors.borderStrong,
        content: colors.text,
        tone: 'default',
      };
    case 'outline':
      return {
        background: colors.surface,
        pressedBackground: colors.primarySoft,
        border: colors.primary,
        content: colors.primary,
        tone: 'accent',
      };
    case 'destructive':
      return {
        background: colors.surface,
        pressedBackground: colors.dangerBg,
        border: colors.danger,
        content: colors.danger,
        tone: 'danger',
      };
    case 'link':
      return {
        background: 'transparent',
        pressedBackground: colors.primarySoft,
        border: 'transparent',
        content: colors.primary,
        tone: 'accent',
      };
    case 'ghost':
      return {
        background: 'transparent',
        pressedBackground: colors.neutralChip,
        border: 'transparent',
        content: colors.textMuted,
        tone: 'muted',
      };
  }
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  loading = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  fullWidth = false,
}: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const look = lookFor(variant, theme.colors);
  const height = {
    large: theme.layout.buttonHeightLarge,
    medium: theme.layout.buttonHeightMedium,
    small: theme.layout.buttonHeightSmall,
  }[size];

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
        height,
        minHeight: theme.minTouchTarget,
        minWidth: theme.minTouchTarget,
        paddingHorizontal: theme.spacing.lg,
        borderRadius: size === 'large' ? theme.radii.lg : theme.radii.md,
        borderWidth: theme.layout.borderWidth,
        borderColor: focused ? theme.colors.focusRing : look.border,
        backgroundColor: pressed ? look.pressedBackground : look.background,
        opacity: inactive ? 0.5 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
      })}
    >
      {loading ? <ActivityIndicator color={look.content} /> : null}
      {icon === undefined || loading ? null : <Icon name={icon} color={look.content} size={22} />}
      <Text variant={size === 'large' ? 'button' : 'buttonSmall'} tone={look.tone} align="center">
        {label}
      </Text>
    </Pressable>
  );
}
