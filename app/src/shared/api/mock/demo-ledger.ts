import type { Transaction } from '@/features/accounts';

function demoTransaction(
  accountId: string,
  idBase: number,
  sequence: number,
  bookedAt: string,
  direction: Transaction['direction'],
  kind: Transaction['kind'],
  amountGrosze: number,
  title: string,
): Transaction {
  return {
    id: `00000000-0000-4000-8000-${String(idBase + sequence).padStart(12, '0')}`,
    accountId,
    direction,
    kind,
    amountGrosze,
    title,
    counterpartyName: title,
    bookedAt,
  };
}

/** The four operations of the design, newest first; the dashboard and the employee panel show the same. */
export function demoTransactions(accountId: string, idBase: number): Transaction[] {
  return [
    demoTransaction(
      accountId,
      idBase,
      1,
      '2026-10-08T07:30:00.000Z',
      'incoming',
      'transfer',
      540_000,
      'Wynagrodzenie',
    ),
    demoTransaction(
      accountId,
      idBase,
      2,
      '2026-10-07T08:12:00.000Z',
      'outgoing',
      'qr_payment',
      1_840,
      'Piekarnia Pod Lipą',
    ),
    demoTransaction(
      accountId,
      idBase,
      3,
      '2026-10-05T10:00:00.000Z',
      'incoming',
      'transfer',
      12_000,
      'Marek Wiśniewski',
    ),
    demoTransaction(
      accountId,
      idBase,
      4,
      '2026-10-02T16:45:00.000Z',
      'outgoing',
      'link_payment',
      24_900,
      'Sklep Rowerowy Szprycha',
    ),
  ];
}
