import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MockBadge } from './MockBadge';
import { useScreenEdges } from './ScreenEdges';
import { ScreenHeader } from './ScreenHeader';
import { Text } from './Text';
import { useTheme } from './ThemeProvider';

interface ScreenProps {
  readonly children: ReactNode;
  /** Omit when the navigator already shows a header with the same title. */
  readonly title?: string;
  /** With `onBack` the title is shown next to a back arrow whose accessible name is `backLabel`. */
  readonly onBack?: () => void;
  readonly backLabel?: string;
  /** `wide` is for employee and admin screens on desktop browsers. */
  readonly width?: 'narrow' | 'wide';
  readonly scroll?: boolean;
  /** Side margin: 20 px, 24 px on the login screen. */
  readonly gutter?: 'gutter' | 'xl';
  /** Stretches the content to the full height, so a bottom block can sit at the bottom (login). */
  readonly fill?: boolean;
}

/** Page wrapper: safe area, scrolling, centred max-width content, header and the mock-mode badge. */
export function Screen({
  children,
  title,
  onBack,
  backLabel,
  width = 'narrow',
  scroll = true,
  gutter = 'gutter',
  fill = false,
}: ScreenProps) {
  const theme = useTheme();
  const edges = useScreenEdges();
  const maxWidth =
    width === 'wide' ? theme.layout.contentMaxWidthWide : theme.layout.contentMaxWidthNarrow;
  const header =
    title === undefined ? null : onBack !== undefined && backLabel !== undefined ? (
      <ScreenHeader title={title} backLabel={backLabel} onBack={onBack} />
    ) : (
      <Text variant="title">{title}</Text>
    );
  const content = (
    <View
      style={{
        width: '100%',
        maxWidth,
        gap: theme.spacing.lg,
        ...(fill ? { flexGrow: 1 } : {}),
      }}
    >
      <MockBadge />
      {header}
      {children}
    </View>
  );
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{
            alignItems: 'center',
            ...(fill ? { flexGrow: 1 } : {}),
            paddingHorizontal: theme.spacing[gutter],
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.xxl,
          }}
        >
          {content}
        </ScrollView>
      ) : (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            paddingHorizontal: theme.spacing[gutter],
            paddingTop: theme.spacing.md,
          }}
        >
          {content}
        </View>
      )}
    </SafeAreaView>
  );
}
