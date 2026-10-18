import { isValidPolishIban, normalizeIban } from '@/shared/lib/iban';

// B-22: switch to the generated schema type once the recipients endpoints exist.
export interface Recipient {
  readonly id: string;
  readonly name: string;
  /** Normalized (upper-case, no spaces). */
  readonly iban: string;
}

export interface RecipientInput {
  readonly name: string;
  readonly iban: string;
}

export type RecipientFormError = 'nameRequired' | 'ibanInvalid';

/** Mirrors the API rules for instant feedback; the server remains the authority. */
export function validateRecipientInput(input: RecipientInput): readonly RecipientFormError[] {
  const errors: RecipientFormError[] = [];
  if (input.name.trim() === '') {
    errors.push('nameRequired');
  }
  if (!isValidPolishIban(input.iban)) {
    errors.push('ibanInvalid');
  }
  return errors;
}

export function toNormalizedRecipientInput(input: RecipientInput): RecipientInput {
  return { name: input.name.trim(), iban: normalizeIban(input.iban) };
}
