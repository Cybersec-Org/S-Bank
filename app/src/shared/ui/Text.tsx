import { Text as NativeText, type TextProps as NativeTextProps } from 'react-native';

import { useTheme } from './ThemeProvider';
import type { ColorTokens, TypographyKey } from './theme';

export type TextTone = 'default' | 'muted' | 'accent' | 'danger' | 'success' | 'inverse';

const TONE_COLOR: Readonly<Record<TextTone, keyof ColorTokens>> = {
  default: 'text',
  muted: 'textMuted',
  accent: 'accent',
  danger: 'danger',
  success: 'success',
  inverse: 'textOnAccent',
};

interface TextProps extends Omit<NativeTextProps, 'style'> {
  readonly variant?: TypographyKey;
  readonly tone?: TextTone;
  readonly align?: 'left' | 'center' | 'right';
  /** Equal-width digits so amounts line up in columns. */
  readonly tabular?: boolean;
}

const HEADING_VARIANTS: ReadonlySet<TypographyKey> = new Set(['title', 'heading']);

export function Text({
  variant = 'body',
  tone = 'default',
  align = 'left',
  tabular = false,
  accessibilityRole,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const role = accessibilityRole ?? (HEADING_VARIANTS.has(variant) ? 'header' : undefined);
  return (
    <NativeText
      {...rest}
      {...(role === undefined ? {} : { accessibilityRole: role })}
      style={[
        theme.typography[variant],
        { color: theme.colors[TONE_COLOR[tone]], textAlign: align },
        tabular ? { fontVariant: ['tabular-nums'] } : null,
      ]}
    />
  );
}
