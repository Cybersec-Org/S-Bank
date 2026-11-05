import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';

import { pl } from '@/shared/i18n/pl';
import { Icon } from './Icon';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';

export interface SelectOption<Value extends string> {
  readonly value: Value;
  readonly label: string;
}

interface SelectFieldProps<Value extends string> {
  readonly label: string;
  readonly value: Value;
  readonly options: readonly SelectOption<Value>[];
  readonly onChange: (value: Value) => void;
  /** Title of the sheet that lists the options. */
  readonly sheetTitle: string;
  /** Text shown in the closed field; defaults to the label of the selected option. */
  readonly displayValue?: string;
}

/**
 * Choice from a list in a bottom sheet. One component for web and phone, instead of a native
 * `<select>` that looks and behaves differently on each platform.
 */
export function SelectField<Value extends string>({
  label,
  value,
  options,
  onChange,
  sheetTitle,
  displayValue,
}: SelectFieldProps<Value>) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const shown = displayValue ?? selected?.label ?? '';
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shown}`}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => ({
          height: theme.layout.fieldHeight,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radii.field,
          borderWidth: theme.layout.borderWidth,
          borderColor: theme.colors.borderStrong,
          backgroundColor: pressed ? theme.colors.neutralChip : theme.colors.surface,
        })}
      >
        <Text variant="body">{shown}</Text>
        <Icon name="chevronDown" color={theme.colors.textMuted} size={20} />
      </Pressable>
      <Modal
        statusBarTranslucent
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          accessibilityLabel={pl.common.cancel}
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            alignItems: 'center',
            backgroundColor: theme.colors.scrim,
          }}
        >
          <View
            aria-modal
            style={{
              width: '100%',
              maxWidth: theme.layout.contentMaxWidthNarrow,
              padding: theme.spacing.gutter,
              gap: theme.spacing.sm,
              borderTopLeftRadius: theme.radii.xl,
              borderTopRightRadius: theme.radii.xl,
              backgroundColor: theme.colors.surface,
            }}
          >
            <Text variant="screenTitle">{sheetTitle}</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel={sheetTitle}>
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    accessibilityRole="radio"
                    accessibilityLabel={option.label}
                    accessibilityState={{ selected: isSelected, checked: isSelected }}
                    style={{
                      minHeight: theme.minTouchTarget,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: theme.spacing.md,
                      borderBottomWidth: theme.layout.borderWidth,
                      borderBottomColor: theme.colors.divider,
                    }}
                  >
                    <Text variant="listTitle" tone={isSelected ? 'accent' : 'default'}>
                      {option.label}
                    </Text>
                    {isSelected ? (
                      <Icon name="check" color={theme.colors.primary} size={20} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
