import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { pl } from '@/shared/i18n/pl';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';

interface TextFieldProps extends Pick<
  TextInputProps,
  'keyboardType' | 'autoCapitalize' | 'maxLength' | 'returnKeyType' | 'onSubmitEditing' | 'editable'
> {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
  readonly placeholder?: string;
  /** Maximum width, for example the employee search box. */
  readonly maxWidth?: number;
}

/**
 * Text input with label, hint and inline error. There is deliberately no secure-text option: the app
 * never collects passwords (login happens in the system browser).
 */
export function TextField({
  label,
  value,
  onChangeText,
  error,
  hint,
  placeholder,
  maxWidth,
  ...inputProps
}: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const hasError = error !== undefined && error !== '';
  return (
    <View
      style={{
        gap: theme.spacing.xs,
        ...(maxWidth === undefined ? {} : { maxWidth, width: '100%' as const }),
      }}
    >
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <TextInput
        {...inputProps}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label}
        {...(hint === undefined ? {} : { accessibilityHint: hint })}
        aria-invalid={hasError}
        {...(placeholder === undefined ? {} : { placeholder })}
        placeholderTextColor={theme.colors.textDisabled}
        autoCorrect={false}
        autoComplete="off"
        style={[
          theme.typography.body,
          {
            height: theme.layout.fieldHeight,
            paddingHorizontal: theme.spacing.lg,
            color: theme.colors.text,
            backgroundColor: theme.colors.surface,
            borderWidth: focused ? theme.layout.focusRingWidth : theme.layout.borderWidth,
            borderRadius: theme.radii.field,
            borderColor: hasError
              ? theme.colors.danger
              : focused
                ? theme.colors.focusRing
                : theme.colors.borderStrong,
          },
        ]}
      />
      {hint === undefined || hasError ? null : (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      )}
      {hasError ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {`${pl.common.fieldError}: ${error}`}
        </Text>
      ) : null}
    </View>
  );
}
