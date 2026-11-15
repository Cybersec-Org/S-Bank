import { TextInput, View } from 'react-native';

import { pl } from '@/shared/i18n/pl';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';

interface AmountFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
  readonly placeholder?: string;
}

/** A dot typed on a phone keyboard becomes the Polish decimal comma. */
function withDecimalComma(text: string): string {
  return text.replace('.', ',');
}

/**
 * The large amount field of the transfer form: 64 px high, 2 px brand border, currency suffix and a
 * decimal keyboard. The value stays a string; parsing to grosze happens in `parseAmountToGrosze`.
 */
export function AmountField({
  label,
  value,
  onChangeText,
  error,
  hint,
  placeholder,
}: AmountFieldProps) {
  const theme = useTheme();
  const hasError = error !== undefined && error !== '';
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <View
        style={{
          height: theme.layout.amountFieldHeight,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          backgroundColor: theme.colors.surface,
          borderWidth: theme.layout.amountBorderWidth,
          borderRadius: theme.radii.field,
          borderColor: hasError ? theme.colors.danger : theme.colors.primary,
        }}
      >
        <TextInput
          value={value}
          onChangeText={(text) => onChangeText(withDecimalComma(text))}
          keyboardType="decimal-pad"
          accessibilityLabel={label}
          {...(hint === undefined ? {} : { accessibilityHint: hint })}
          aria-invalid={hasError}
          {...(placeholder === undefined ? {} : { placeholder })}
          placeholderTextColor={theme.colors.textDisabled}
          autoCorrect={false}
          autoComplete="off"
          style={[
            theme.typography.amountInput,
            { flex: 1, minWidth: 0, color: theme.colors.text, fontVariant: ['tabular-nums'] },
          ]}
        />
        <Text variant="amountInput" tone="muted" aria-hidden>
          {pl.common.currencySuffix}
        </Text>
      </View>
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
