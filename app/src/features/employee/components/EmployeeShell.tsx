import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { useSession } from '@/shared/auth/SessionProvider';
import { pl } from '@/shared/i18n/pl';
import { Button, Chip, Icon, Logo, Text, useTheme, type IconName } from '@/shared/ui';

const LOGO_SIZE = 40;

interface MenuItemProps {
  readonly label: string;
  readonly icon: IconName;
  readonly state: 'active' | 'idle' | 'locked';
  readonly note?: string;
  readonly onPress?: () => void;
}

function MenuItem({ label, icon, state, note, onPress }: MenuItemProps) {
  const theme = useTheme();
  const active = state === 'active';
  const locked = state === 'locked';
  const color = active
    ? theme.colors.onPrimary
    : locked
      ? theme.colors.textDisabled
      : theme.colors.text;
  const spoken = note === undefined ? label : `${label}, ${note}`;
  return (
    <Pressable
      disabled={onPress === undefined}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityState={{ selected: active, disabled: locked || onPress === undefined }}
      style={{
        minHeight: theme.minTouchTarget,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radii.md,
        backgroundColor: active ? theme.colors.primary : 'transparent',
      }}
    >
      <Icon name={locked ? 'lock' : icon} color={color} size={20} />
      <View style={{ flexShrink: 1 }}>
        <Text variant="listTitle" tone={active ? 'inverse' : locked ? 'disabled' : 'default'}>
          {label}
        </Text>
        {note === undefined ? null : (
          <Text variant="caption" tone="disabled">
            {note}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

interface EmployeeShellProps {
  readonly children: ReactNode;
}

/** Top bar and side menu of the employee panel; below 900 px the menu sits above the content. */
export function EmployeeShell({ children }: EmployeeShellProps) {
  const theme = useTheme();
  const router = useRouter();
  const session = useSession();
  const { width } = useWindowDimensions();
  const stacked = width < theme.layout.employeeStackBreakpoint;

  function handleSignOut(): void {
    session.signOut();
    router.replace('/');
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderBottomWidth: theme.layout.borderWidth,
          borderBottomColor: theme.colors.border,
          alignItems: 'center',
          paddingHorizontal: theme.spacing.gutter,
          paddingVertical: theme.spacing.md,
        }}
      >
        <View
          style={{
            width: '100%',
            maxWidth: theme.layout.contentMaxWidthWide,
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.md,
          }}
        >
          <View
            style={{
              flexShrink: 1,
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: theme.spacing.md,
            }}
          >
            <Logo size={LOGO_SIZE} />
            <Text variant="screenTitle" accessibilityRole="header">
              {pl.common.appName}
            </Text>
            <Chip tone="neutral" label={pl.employee.panelLabel} />
          </View>
          <View
            style={{
              flexShrink: 1,
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: theme.spacing.md,
            }}
          >
            <Chip tone="soft" icon="key" label={pl.employee.signedInWithPasskey} />
            {session.principal === null ? null : (
              <Text variant="listTitle">{session.principal.displayName}</Text>
            )}
            <Button
              label={pl.employee.signOut}
              accessibilityLabel={pl.nav.signOutLabel}
              variant="secondary"
              size="small"
              icon="logout"
              onPress={handleSignOut}
            />
          </View>
        </View>
      </View>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <View
          style={{
            flex: 1,
            width: '100%',
            maxWidth: theme.layout.contentMaxWidthWide,
            flexDirection: stacked ? 'column' : 'row',
            gap: theme.spacing.xl,
            paddingTop: theme.spacing.lg,
          }}
        >
          <View
            accessibilityLabel={pl.employee.menuLabel}
            style={{
              gap: theme.spacing.xs,
              paddingHorizontal: theme.spacing.gutter,
              ...(stacked ? {} : { width: 260 }),
            }}
          >
            <MenuItem
              label={pl.employee.menuCustomers}
              icon="users"
              state="active"
              onPress={() => router.replace('/customers')}
            />
            <MenuItem label={pl.employee.menuAccounts} icon="wallet" state="idle" />
            <MenuItem
              label={pl.employee.menuAudit}
              icon="file"
              state="locked"
              note={pl.employee.adminOnly}
            />
            <MenuItem
              label={pl.employee.menuPartners}
              icon="store"
              state="locked"
              note={pl.employee.adminOnly}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
        </View>
      </View>
    </View>
  );
}
