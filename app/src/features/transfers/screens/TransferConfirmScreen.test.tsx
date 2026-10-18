import { fireEvent, screen } from '@testing-library/react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { FAKE_IBANS, MOCK_MAIN_ACCOUNT_ID } from '@/shared/api/mock/mock-data';
import { ApiProblem } from '@/shared/api/problem';
import type { Repositories } from '@/shared/api/repositories';
import { pl } from '@/shared/i18n/pl';
import { renderWithProviders } from '@/shared/testing/renderWithProviders';

import type { TransferDraft } from '../model/transfer';
import { TransferConfirmScreen } from './TransferConfirmScreen';

const NBSP = ' ';
const UNKNOWN_DRAFT_ID = '00000000-0000-4000-8000-000000009999';

async function seedDraft(repositories: Repositories, amountGrosze: number): Promise<TransferDraft> {
  const draft = await repositories.transfers.createDraft({
    sourceAccountId: MOCK_MAIN_ACCOUNT_ID,
    recipientName: 'Jan Przykładowy',
    recipientIban: FAKE_IBANS.recipientJan,
    title: 'Zwrot za bilety',
    amountGrosze,
  });
  jest.mocked(useLocalSearchParams).mockReturnValue({ draftId: draft.id });
  return draft;
}

describe('TransferConfirmScreen', () => {
  it('shows the server-side draft with the full recipient IBAN and the amount', async () => {
    await renderWithProviders(<TransferConfirmScreen />, {
      signedInAs: 'customer',
      arrange: async (repositories) => {
        await seedDraft(repositories, 15_000);
      },
    });

    expect(await screen.findByText('Jan Przykładowy')).toBeOnTheScreen();
    expect(screen.getByText('Zwrot za bilety')).toBeOnTheScreen();
    expect(screen.getByText(`150,00${NBSP}zł`)).toBeOnTheScreen();
    expect(screen.getByText('PL42 1234 5678 0000 0000 0000 0003')).toBeOnTheScreen();
    expect(screen.queryByText(pl.transferConfirm.stepUpHeading)).not.toBeOnTheScreen();
  });

  it('confirms a small transfer and shows the result with the operation number', async () => {
    const { repositories } = await renderWithProviders(<TransferConfirmScreen />, {
      signedInAs: 'customer',
      arrange: async (base) => {
        await seedDraft(base, 15_000);
      },
    });

    await fireEvent.press(await screen.findByRole('button', { name: pl.transferConfirm.confirm }));

    expect(await screen.findByText(pl.transferConfirm.successTitle)).toBeOnTheScreen();
    expect(screen.getByText(/Numer operacji: OP-2026-000001/)).toBeOnTheScreen();
    const [account] = await repositories.accounts.listAccounts();
    expect(account?.balanceGrosze).toBe(1_254_320 - 15_000);
  });

  it('explains the step-up for 1 000 zł and keeps confirmation disabled until it is done', async () => {
    await renderWithProviders(<TransferConfirmScreen />, {
      signedInAs: 'customer',
      arrange: async (repositories) => {
        await seedDraft(repositories, 150_000);
      },
    });

    expect(await screen.findByText(pl.transferConfirm.stepUpHeading)).toBeOnTheScreen();
    expect(screen.getByText(pl.transferConfirm.stepUpBody)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: pl.transferConfirm.confirm })).toBeDisabled();
  });

  it('enables confirmation after the (mock) passkey step-up and completes the transfer', async () => {
    await renderWithProviders(<TransferConfirmScreen />, {
      signedInAs: 'customer',
      arrange: async (repositories) => {
        await seedDraft(repositories, 150_000);
      },
    });

    await fireEvent.press(
      await screen.findByRole('button', { name: pl.transferConfirm.stepUpMockButton }),
    );
    expect(screen.getByText(pl.transferConfirm.stepUpDone)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: pl.transferConfirm.confirm }));

    expect(await screen.findByText(pl.transferConfirm.successTitle)).toBeOnTheScreen();
  });

  it('offers no mock step-up button in live mode', async () => {
    await renderWithProviders(<TransferConfirmScreen />, {
      apiMode: 'live',
      signedInAs: 'customer',
      arrange: async (repositories) => {
        await seedDraft(repositories, 150_000);
      },
    });

    await screen.findByText(pl.transferConfirm.stepUpHeading);

    expect(
      screen.queryByRole('button', { name: pl.transferConfirm.stepUpMockButton }),
    ).not.toBeOnTheScreen();
  });

  it('shows the API problem in Polish and reuses the idempotency key when retrying', async () => {
    const keys: string[] = [];
    let attempt = 0;
    await renderWithProviders(<TransferConfirmScreen />, {
      signedInAs: 'customer',
      arrange: async (repositories) => {
        await seedDraft(repositories, 15_000);
      },
      repositories: (base) => ({
        ...base,
        transfers: {
          ...base.transfers,
          confirmDraft: (input) => {
            keys.push(input.idempotencyKey);
            attempt += 1;
            return attempt === 1
              ? Promise.reject(new ApiProblem({ status: 503 }))
              : base.transfers.confirmDraft(input);
          },
        },
      }),
    });

    await fireEvent.press(await screen.findByRole('button', { name: pl.transferConfirm.confirm }));
    expect(await screen.findByText(pl.errors.server)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: pl.transferConfirm.confirm }));

    expect(await screen.findByText(pl.transferConfirm.successTitle)).toBeOnTheScreen();
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('maps a server-side step-up refusal to the Polish explanation', async () => {
    await renderWithProviders(<TransferConfirmScreen />, {
      signedInAs: 'customer',
      arrange: async (repositories) => {
        await seedDraft(repositories, 15_000);
      },
      repositories: (base) => ({
        ...base,
        transfers: {
          ...base.transfers,
          confirmDraft: () =>
            Promise.reject(new ApiProblem({ status: 403, code: 'step_up_required' })),
        },
      }),
    });

    await fireEvent.press(await screen.findByRole('button', { name: pl.transferConfirm.confirm }));

    expect(await screen.findByText(pl.errors.stepUpRequired)).toBeOnTheScreen();
  });

  it('cancels the draft', async () => {
    const { repositories } = await renderWithProviders(<TransferConfirmScreen />, {
      signedInAs: 'customer',
      arrange: async (base) => {
        await seedDraft(base, 15_000);
      },
    });

    await fireEvent.press(await screen.findByRole('button', { name: pl.transferConfirm.cancel }));

    expect(await screen.findByText(pl.transferConfirm.cancelledTitle)).toBeOnTheScreen();
    const [account] = await repositories.accounts.listAccounts();
    expect(account?.balanceGrosze).toBe(1_254_320);
  });

  it('rejects a malformed draft id without calling the API', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ draftId: '../../etc/passwd' });
    const getDraft = jest.fn();
    await renderWithProviders(<TransferConfirmScreen />, {
      signedInAs: 'customer',
      repositories: (base) => ({ ...base, transfers: { ...base.transfers, getDraft } }),
    });

    expect(screen.getByText(pl.transferConfirm.invalidLink)).toBeOnTheScreen();
    expect(getDraft).not.toHaveBeenCalled();
  });

  it('shows a not-found error for a draft that does not exist or belongs to someone else', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ draftId: UNKNOWN_DRAFT_ID });
    await renderWithProviders(<TransferConfirmScreen />, { signedInAs: 'customer' });

    expect(await screen.findByText(pl.errors.notFound)).toBeOnTheScreen();
  });

  it('returns to the dashboard from the result screen', async () => {
    await renderWithProviders(<TransferConfirmScreen />, {
      signedInAs: 'customer',
      arrange: async (repositories) => {
        await seedDraft(repositories, 15_000);
      },
    });
    await fireEvent.press(await screen.findByRole('button', { name: pl.transferConfirm.confirm }));

    await fireEvent.press(await screen.findByRole('button', { name: pl.transferConfirm.done }));

    expect(useRouter().replace).toHaveBeenCalledWith('/dashboard');
  });
});
