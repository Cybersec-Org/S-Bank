import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';
import { MockBadge } from './MockBadge';

interface ScreenProps {
  readonly children: ReactNode;
  /** Omit when the navigator already shows a header with the same title. */
  readonly title?: string;
  /** `wide` is for employee and admin screens on desktop browsers. */
  readonly width?: 'narrow' | 'wide';
  readonly scroll?: boolean;
}

/** Page wrapper: safe area, scrolling, centred max-width content, title and the mock-mode badge. */
export function Screen({ children, title, width = 'narrow', scroll = true }: ScreenProps) {
  const theme = useTheme();
  const maxWidth =
    width === 'wide' ? theme.layout.contentMaxWidthWide : theme.layout.contentMaxWidthNarrow;
  const content = (
    <View style={{ width: '100%', maxWidth, gap: theme.spacing.lg }}>
      <MockBadge />
      {title === undefined ? null : <Text variant="title">{title}</Text>}
      {children}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            alignItems: 'center',
            padding: theme.spacing.lg,
            paddingBottom: theme.spacing.xxl,
          }}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', padding: theme.spacing.lg }}>{content}</View>
      )}
    </SafeAreaView>
  );
}
