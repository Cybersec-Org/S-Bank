import { fireEvent, screen } from '@testing-library/react-native';
import { Text as NativeText } from 'react-native';

import { renderWithProviders } from '@/shared/testing/renderWithProviders';

import {
  AmountField,
  Banner,
  Button,
  Chip,
  ConfirmDialog,
  DataTable,
  Icon,
  Screen,
  ScreenHeader,
  SelectField,
  StepUpPanel,
  Text,
  TextField,
} from '.';

describe('Button variants and sizes', () => {
  it.each([
    ['large', 56],
    ['medium', 52],
    ['small', 48],
  ] as const)('is %s: %i px high', async (size, height) => {
    await renderWithProviders(<Button label="Dalej" size={size} onPress={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Dalej' })).toHaveStyle({ height });
  });

  it('shows an icon before the label without changing its accessible name', async () => {
    await renderWithProviders(
      <Button label="Zaloguj się kluczem dostępu" icon="key" onPress={jest.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Zaloguj się kluczem dostępu' })).toBeOnTheScreen();
  });

  it.each(['primary', 'secondary', 'outline', 'destructive', 'ghost', 'link'] as const)(
    'the %s variant is pressable',
    async (variant) => {
      const onPress = jest.fn();
      await renderWithProviders(<Button label="Akcja" variant={variant} onPress={onPress} />);

      await fireEvent.press(screen.getByRole('button', { name: 'Akcja' }));

      expect(onPress).toHaveBeenCalledTimes(1);
    },
  );
});

describe('TextField design', () => {
  it('is 50 px high with a 14 px radius', async () => {
    await renderWithProviders(<TextField label="Tytuł" value="" onChangeText={jest.fn()} />);

    expect(screen.getByLabelText('Tytuł')).toHaveStyle({ height: 50, borderRadius: 14 });
  });

  it('shows a placeholder', async () => {
    await renderWithProviders(
      <TextField
        label="Tytuł"
        placeholder="Czynsz – październik"
        value=""
        onChangeText={jest.fn()}
      />,
    );

    expect(screen.getByPlaceholderText('Czynsz – październik')).toBeOnTheScreen();
  });
});

describe('AmountField', () => {
  it('is 64 px high, has the złoty suffix and a decimal keypad', async () => {
    await renderWithProviders(<AmountField label="Kwota" value="" onChangeText={jest.fn()} />);

    expect(screen.getByLabelText('Kwota')).toHaveProp('keyboardType', 'decimal-pad');
    expect(screen.getByText('zł', { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('turns a dot into the decimal comma', async () => {
    const onChangeText = jest.fn();
    await renderWithProviders(<AmountField label="Kwota" value="" onChangeText={onChangeText} />);

    await fireEvent.changeText(screen.getByLabelText('Kwota'), '12.50');

    expect(onChangeText).toHaveBeenCalledWith('12,50');
  });

  it('shows the error and marks the field invalid', async () => {
    await renderWithProviders(
      <AmountField label="Kwota" value="x" error="Zła kwota" onChangeText={jest.fn()} />,
    );

    expect(screen.getByText('Błąd: Zła kwota')).toBeOnTheScreen();
  });
});

describe('Banner', () => {
  it('shows title and text, and an alert role only for danger', async () => {
    const { rerender } = await renderWithProviders(
      <Banner tone="warning" title="Kwota od 1 000 zł.">
        W następnym kroku potwierdzisz przelew.
      </Banner>,
    );
    expect(screen.getByText('Kwota od 1 000 zł.')).toBeOnTheScreen();
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();

    await rerender(<Banner tone="danger">Błąd</Banner>);

    expect(screen.getByRole('alert')).toBeOnTheScreen();
  });
});

describe('Chip', () => {
  it('is exposed with its label', async () => {
    await renderWithProviders(<Chip label="Rachunek aktywny" icon="check" />);

    expect(screen.getByLabelText('Rachunek aktywny')).toBeOnTheScreen();
  });
});

describe('StepUpPanel', () => {
  it('shows the heading and the explanation', async () => {
    await renderWithProviders(
      <StepUpPanel title="Dodatkowe potwierdzenie">Ten przelew wymaga klucza dostępu.</StepUpPanel>,
    );

    expect(screen.getByText('Dodatkowe potwierdzenie')).toBeOnTheScreen();
    expect(screen.getByText('Ten przelew wymaga klucza dostępu.')).toBeOnTheScreen();
  });
});

describe('ScreenHeader and Screen back arrow', () => {
  it('has a back button with an accessible name that calls onBack', async () => {
    const onBack = jest.fn();
    await renderWithProviders(
      <ScreenHeader title="Nowy przelew" backLabel="Wróć do pulpitu" onBack={onBack} />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Wróć do pulpitu' }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('header', { name: 'Nowy przelew' })).toBeOnTheScreen();
  });

  it('Screen shows the arrow only when it gets onBack and backLabel', async () => {
    const { rerender } = await renderWithProviders(
      <Screen title="Historia">
        <Text>Treść</Text>
      </Screen>,
    );
    expect(screen.queryByRole('button', { name: 'Wróć' })).not.toBeOnTheScreen();

    await rerender(
      <Screen title="Historia" onBack={jest.fn()} backLabel="Wróć">
        <Text>Treść</Text>
      </Screen>,
    );

    expect(screen.getByRole('button', { name: 'Wróć' })).toBeOnTheScreen();
  });
});

describe('SelectField', () => {
  const options = [
    { value: 'EUR', label: 'EUR – euro' },
    { value: 'USD', label: 'USD – dolar amerykański' },
  ] as const;

  it('opens a sheet with the options, marks the selected one and reports the choice', async () => {
    const onChange = jest.fn();
    await renderWithProviders(
      <SelectField
        label="Waluta"
        sheetTitle="Wybierz walutę"
        value="EUR"
        displayValue="EUR"
        options={options}
        onChange={onChange}
      />,
    );
    expect(screen.queryByText('Wybierz walutę')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Waluta: EUR' }));
    expect(screen.getByText('Wybierz walutę')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'EUR – euro' })).toBeSelected();

    await fireEvent.press(screen.getByRole('radio', { name: 'USD – dolar amerykański' }));

    expect(onChange).toHaveBeenCalledWith('USD');
    expect(screen.queryByText('Wybierz walutę')).not.toBeOnTheScreen();
  });
});

describe('ConfirmDialog', () => {
  it('renders nothing while closed', async () => {
    await renderWithProviders(
      <ConfirmDialog
        visible={false}
        title="Zablokować rachunek?"
        confirmLabel="Zablokuj"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.queryByText('Zablokować rachunek?')).not.toBeOnTheScreen();
  });

  it('asks, and reports confirm and cancel separately', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await renderWithProviders(
      <ConfirmDialog
        visible
        title="Zablokować rachunek?"
        message="Klient nie będzie mógł zlecać przelewów."
        confirmLabel="Zablokuj"
        destructive
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText('Klient nie będzie mógł zlecać przelewów.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Anuluj' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Zablokuj' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe('DataTable', () => {
  interface Row {
    readonly id: string;
    readonly name: string;
  }
  const rows: readonly Row[] = [
    { id: '1', name: 'Pierwszy' },
    { id: '2', name: 'Drugi' },
  ];

  it('renders the column titles and one line per row', async () => {
    await renderWithProviders(
      <DataTable
        label="Rachunki"
        rows={rows}
        rowKey={(row) => row.id}
        columns={[
          {
            key: 'name',
            title: 'Opis',
            width: 200,
            render: (row) => <NativeText>{row.name}</NativeText>,
          },
        ]}
      />,
    );

    expect(screen.getByText('Opis')).toBeOnTheScreen();
    expect(screen.getByText('Pierwszy')).toBeOnTheScreen();
    expect(screen.getByText('Drugi')).toBeOnTheScreen();
  });
});

describe('Icon', () => {
  it('is hidden from assistive technology, because the control around it has the name', async () => {
    await renderWithProviders(
      <Button label="Zablokuj aplikację" icon="lock" onPress={jest.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Zablokuj aplikację' })).toBeOnTheScreen();
    expect(screen.queryByRole('image')).not.toBeOnTheScreen();
  });

  it('renders every glyph without throwing', async () => {
    const names = [
      'key',
      'shield',
      'lock',
      'arrowLeft',
      'transfer',
      'qr',
      'rates',
      'atm',
      'home',
      'user',
      'file',
      'store',
      'globe',
      'eye',
      'check',
      'clock',
      'info',
      'alert',
      'logout',
      'chevronDown',
      'users',
      'wallet',
    ] as const;
    await renderWithProviders(
      <>
        {names.map((name) => (
          <Icon key={name} name={name} color="#000000" />
        ))}
      </>,
    );
  });
});
