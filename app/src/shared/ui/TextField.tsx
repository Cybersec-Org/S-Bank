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
  ...inputProps
}: TextFieldProps) {
  const theme = useTheme();
  const hasError = error !== undefined && error !== '';
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text variant="label">{label}</Text>
      <TextInput
        {...inputProps}
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={label}
        {...(hint === undefined ? {} : { accessibilityHint: hint })}
        aria-invalid={hasError}
        {...(placeholder === undefined ? {} : { placeholder })}
        placeholderTextColor={theme.colors.textMuted}
        autoCorrect={false}
        autoComplete="off"
        style={[
          theme.typography.body,
          {
            minHeight: theme.minTouchTarget,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            color: theme.colors.text,
            backgroundColor: theme.colors.surface,
            borderWidth: theme.layout.borderWidth,
            borderRadius: theme.radii.md,
            borderColor: hasError ? theme.colors.danger : theme.colors.border,
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
