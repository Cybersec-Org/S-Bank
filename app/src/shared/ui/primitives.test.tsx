import { fireEvent, screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/shared/testing/renderWithProviders';

import {
  Banner,
  Button,
  ChoiceGroup,
  EmptyState,
  ErrorState,
  ListItem,
  LoadingState,
  MockBadge,
  MoneyText,
  PlaceholderBlock,
  ProgressBar,
  Screen,
  Text,
  TextField,
  Toggle,
} from '.';

describe('Button', () => {
  it('is exposed as a button with its label and calls onPress', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Zapisz" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Zapisz' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('uses an explicit accessibility label when given', async () => {
    await renderWithProviders(
      <Button label="Usuń" accessibilityLabel="Usuń odbiorcę Anna" onPress={jest.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'Usuń odbiorcę Anna' })).toBeOnTheScreen();
  });

  it('ignores presses while loading and reports busy', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Wyślij" onPress={onPress} loading />);

    await fireEvent.press(screen.getByRole('button', { name: 'Wyślij' }));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Wyślij' })).toBeBusy();
  });

  it('ignores presses when disabled', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Dalej" onPress={onPress} disabled />);

    await fireEvent.press(screen.getByRole('button', { name: 'Dalej' }));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Dalej' })).toBeDisabled();
  });

  it('keeps a minimum touch target of 44', async () => {
    await renderWithProviders(<Button label="Mały" onPress={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Mały' })).toHaveStyle({
      minHeight: 44,
      minWidth: 44,
    });
  });
});

describe('TextField', () => {
  it('is reachable by its label and reports typed text', async () => {
    const onChangeText = jest.fn();
    await renderWithProviders(
      <TextField label="Nazwa odbiorcy" value="" onChangeText={onChangeText} />,
    );

    await fireEvent.changeText(screen.getByLabelText('Nazwa odbiorcy'), 'Jan');

    expect(onChangeText).toHaveBeenCalledWith('Jan');
  });

  it('shows the hint, and the error instead of the hint when invalid', async () => {
    const { rerender } = await renderWithProviders(
      <TextField label="IBAN" hint="PL i 26 cyfr" value="" onChangeText={jest.fn()} />,
    );
    expect(screen.getByText('PL i 26 cyfr')).toBeOnTheScreen();

    await rerender(
      <TextField
        label="IBAN"
        hint="PL i 26 cyfr"
        error="Zły numer"
        value=""
        onChangeText={jest.fn()}
      />,
    );

    expect(screen.getByText('Błąd: Zły numer')).toBeOnTheScreen();
    expect(screen.queryByText('PL i 26 cyfr')).not.toBeOnTheScreen();
  });

  it('is never a password field', async () => {
    await renderWithProviders(<TextField label="Pole" value="" onChangeText={jest.fn()} />);

    expect(screen.getByLabelText('Pole')).not.toHaveProp('secureTextEntry', true);
  });
});

describe('MoneyText', () => {
  it('formats integer grosze for display', async () => {
    await renderWithProviders(<MoneyText grosze={123_450} />);

    expect(screen.getByText('1 234,50 zł')).toBeOnTheScreen();
  });
});

describe('ListItem', () => {
  it('is a button with a spoken label when pressable', async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <ListItem
        title="Anna"
        subtitle="anna@example.test"
        accessibilityLabel="Otwórz Annę"
        onPress={onPress}
      />,
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Otwórz Annę' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('state components', () => {
  it('EmptyState shows title and message', async () => {
    await renderWithProviders(<EmptyState title="Pusto" message="Nic tu nie ma" />);

    expect(screen.getByText('Pusto')).toBeOnTheScreen();
    expect(screen.getByText('Nic tu nie ma')).toBeOnTheScreen();
  });

  it('ErrorState offers a retry', async () => {
    const onRetry = jest.fn();
    await renderWithProviders(<ErrorState message="Błąd sieci" onRetry={onRetry} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Spróbuj ponownie' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('LoadingState announces that it is busy', async () => {
    await renderWithProviders(<LoadingState />);

    expect(screen.getByLabelText('Ładowanie…')).toBeBusy();
  });

  it('PlaceholderBlock shows its label', async () => {
    await renderWithProviders(<PlaceholderBlock label="Skaner QR" />);

    expect(screen.getByLabelText('Skaner QR')).toBeOnTheScreen();
  });

  it('Banner shows a title and text', async () => {
    await renderWithProviders(
      <Banner tone="warning" title="Uwaga">
        Treść
      </Banner>,
    );

    expect(screen.getByText('Uwaga')).toBeOnTheScreen();
    expect(screen.getByText('Treść')).toBeOnTheScreen();
  });
});

describe('MockBadge', () => {
  it('is rendered in mock mode', async () => {
    await renderWithProviders(<MockBadge />, { apiMode: 'mock' });

    expect(screen.getByLabelText('DANE DEMONSTRACYJNE (MOCK)')).toBeOnTheScreen();
  });

  it('is absent in live mode', async () => {
    await renderWithProviders(<MockBadge />, { apiMode: 'live' });

    expect(screen.queryByLabelText('DANE DEMONSTRACYJNE (MOCK)')).not.toBeOnTheScreen();
  });
});

describe('Screen', () => {
  it('shows the title as a heading and the mock badge', async () => {
    await renderWithProviders(
      <Screen title="Pulpit">
        <Text>Treść ekranu</Text>
      </Screen>,
    );

    expect(screen.getByRole('header', { name: 'Pulpit' })).toBeOnTheScreen();
    expect(screen.getByText('Treść ekranu')).toBeOnTheScreen();
    expect(screen.getByLabelText('DANE DEMONSTRACYJNE (MOCK)')).toBeOnTheScreen();
  });
});

describe('ChoiceGroup', () => {
  const options = [
    { value: 'a', label: 'Opcja A' },
    { value: 'b', label: 'Opcja B' },
  ] as const;

  it('marks the selected option as selected and reports changes', async () => {
    const onChange = jest.fn();
    await renderWithProviders(
      <ChoiceGroup label="Wybór" options={options} value="a" onChange={onChange} />,
    );

    expect(screen.getByRole('radio', { name: 'Opcja A' })).toBeSelected();
    expect(screen.getByRole('radio', { name: 'Opcja B' })).not.toBeSelected();

    await fireEvent.press(screen.getByRole('radio', { name: 'Opcja B' }));

    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('Toggle', () => {
  it('is a switch with its label and reports the new value', async () => {
    const onValueChange = jest.fn();
    await renderWithProviders(
      <Toggle label="Biometria" value={false} onValueChange={onValueChange} />,
    );

    await fireEvent(screen.getByRole('switch', { name: 'Biometria' }), 'valueChange', true);

    expect(onValueChange).toHaveBeenCalledWith(true);
  });
});

describe('ProgressBar', () => {
  it('exposes a clamped value to assistive technology', async () => {
    await renderWithProviders(<ProgressBar percent={140} label="Limit" />);

    expect(screen.getByLabelText('Limit')).toHaveAccessibilityValue({ now: 100 });
  });
});
