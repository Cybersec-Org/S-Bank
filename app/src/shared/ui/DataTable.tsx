import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { Text } from './Text';
import { useTheme } from './ThemeProvider';

export interface DataTableColumn<Row> {
  readonly key: string;
  readonly title: string;
  /** Width in px; the table scrolls sideways when the columns do not fit. */
  readonly width: number;
  readonly align?: 'left' | 'right';
  readonly render: (row: Row) => ReactNode;
}

interface DataTableProps<Row> {
  readonly columns: readonly DataTableColumn<Row>[];
  readonly rows: readonly Row[];
  readonly rowKey: (row: Row) => string;
  /** Spoken name of the table. */
  readonly label: string;
}

/** Plain table for the employee panel (web first); scrolls horizontally on a narrow screen. */
export function DataTable<Row>({ columns, rows, rowKey, label }: DataTableProps<Row>) {
  const theme = useTheme();
  const minWidth = columns.reduce((sum, column) => sum + column.width, 0);
  return (
    <ScrollView
      horizontal
      accessibilityLabel={label}
      showsHorizontalScrollIndicator
      contentContainerStyle={{ flexGrow: 1 }}
    >
      <View style={{ flexGrow: 1, minWidth }}>
        <View
          style={{
            flexDirection: 'row',
            paddingBottom: theme.spacing.sm,
            borderBottomWidth: theme.layout.borderWidth,
            borderBottomColor: theme.colors.border,
          }}
        >
          {columns.map((column) => (
            <View
              key={column.key}
              style={{ width: column.width, flexGrow: 1, paddingRight: theme.spacing.md }}
            >
              <Text variant="label" tone="muted" align={column.align ?? 'left'}>
                {column.title}
              </Text>
            </View>
          ))}
        </View>
        {rows.map((row, index) => (
          <View
            key={rowKey(row)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: theme.minTouchTarget + theme.spacing.sm,
              borderBottomWidth: index === rows.length - 1 ? 0 : theme.layout.borderWidth,
              borderBottomColor: theme.colors.divider,
            }}
          >
            {columns.map((column) => (
              <View
                key={column.key}
                style={{
                  width: column.width,
                  flexGrow: 1,
                  paddingRight: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                  alignItems: column.align === 'right' ? 'flex-end' : 'flex-start',
                }}
              >
                {column.render(row)}
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
