/**
 * Financial Arithmetic Utilities in Integer Cents.
 * Avoids all binary floating-point representation errors.
 */

/**
 * Converts a dollar number or string to integer cents.
 * Handles accounting negatives: '(123.45)' -> -12345
 * Handles currency symbols: '$1,234.56' -> 123456
 * Negative numbers: -12.50 -> -1250
 */
export function toCents(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') {
    if (isNaN(val)) return 0;
    return Math.round(val * 100);
  }

  let str = String(val).trim();
  const isAccountingNegative = str.startsWith('(') && str.endsWith(')');
  // Remove currency signs, commas, accounting parens, and spaces
  str = str.replace(/[^0-9.-]/g, '');
  const num = parseFloat(str);
  if (isNaN(num)) return 0;

  const cents = Math.round(num * 100);
  return isAccountingNegative ? -Math.abs(cents) : cents;
}

/**
 * Converts integer cents back to decimal dollars for display.
 */
export function centsToDollars(cents: number): number {
  if (!cents || isNaN(cents)) return 0;
  return cents / 100;
}

/**
 * Formats integer cents to a standard currency string.
 * E.g. 123456 -> "$1,234.56"
 *      -123456 -> "-$1,234.56" or "($1,234.56)"
 */
export function formatCents(cents: number, options?: { accounting?: boolean, showPlus?: boolean }): string {
  const isNeg = cents < 0;
  const absCents = Math.abs(cents);
  const dollars = (absCents / 100).toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  if (isNeg) {
    if (options?.accounting) {
      return `($${dollars})`;
    }
    return `-$${dollars}`;
  }

  if (options?.showPlus && cents > 0) {
    return `+$${dollars}`;
  }

  return `$${dollars}`;
}

/**
 * Deterministic shared expense calculation in integer cents.
 * Supports exact 0%, 50%, 100% split with nullish semantics.
 * A 0% allocation produces exactly 0 cents.
 */
export function calculateSharedCents(originalAmountCents: number, splitPercent: number | undefined | null): number {
  if (originalAmountCents <= 0) return 0;
  // If null or undefined, default to 50%
  const validPercent = (splitPercent !== undefined && splitPercent !== null)
    ? Math.min(100, Math.max(0, splitPercent))
    : 50;

  if (validPercent === 0) return 0;
  if (validPercent === 100) return originalAmountCents;

  return Math.round((originalAmountCents * validPercent) / 100);
}

/**
 * Calculates property management fee in integer cents from the fee base.
 * Rounds ONCE to the nearest cent according to standard accounting policy.
 */
export function calculateManagementFeeCents(feeBaseCents: number, feePercent: number): number {
  if (feeBaseCents <= 0 || feePercent <= 0) return 0;
  return Math.round((feeBaseCents * feePercent) / 100);
}

/**
 * Canonical quarterly ledger balance equation:
 * CLOSING BALANCE = OPENING BALANCE + TOTAL OWNER CREDITS - TOTAL OWNER DEBITS
 */
export function calculateClosingBalanceCents(
  openingBalanceCents: number,
  totalCreditsCents: number,
  totalDebitsCents: number
): number {
  return openingBalanceCents + totalCreditsCents - totalDebitsCents;
}
