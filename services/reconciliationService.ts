import { CanonicalGlRow, CanonicalOtaRow } from '../types';
import { toCents } from './moneyUtils';
import { parseCalendarDate } from './dateUtils';

export interface BookingMatchResult {
  booking: CanonicalOtaRow | null;
  confidence: 'HIGH' | 'MEDIUM' | 'NONE';
  reason: string;
  isAlreadyRecognized: boolean;
  suggestedMode: 'MATCHED_OTA' | 'DIRECT_INCOME' | 'DUPLICATE_EXCLUDE';
}

/**
 * Normalizes text for fuzzy token matching.
 */
function cleanTokens(str: string): string[] {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3);
}

/**
 * Finds if a GL row matches an existing OTA booking or represents direct revenue.
 */
export function findMatchingOtaBooking(
  glRow: CanonicalGlRow,
  otaBookings: CanonicalOtaRow[]
): BookingMatchResult {
  const rowAmountCents = glRow.debit_amount_cents || glRow.credit_amount_cents || toCents(glRow.debit_amount || glRow.credit_amount);
  const rowDate = parseCalendarDate(glRow.date);

  const rowText = `${glRow.description} ${glRow.contact} ${glRow.account_name}`.toLowerCase();
  const rowTokens = cleanTokens(rowText);

  let bestMatch: CanonicalOtaRow | null = null;
  let bestScore = 0;
  let matchReason = '';

  for (const ota of otaBookings) {
    let score = 0;
    const reasons: string[] = [];

    // 1. Direct Reservation ID match (Highest confidence)
    if (ota.reservation_id && rowText.includes(ota.reservation_id.toLowerCase())) {
      score += 100;
      reasons.push(`Matched Booking ID #${ota.reservation_id}`);
    }

    // 2. Guest Name Match
    if (ota.guest_name && ota.guest_name.trim().length > 2) {
      const guestClean = ota.guest_name.toLowerCase().trim();
      const guestTokens = cleanTokens(guestClean);

      if (rowText.includes(guestClean)) {
        score += 60;
        reasons.push(`Exact guest name match "${ota.guest_name}"`);
      } else {
        const matchingTokens = guestTokens.filter(gt => rowTokens.includes(gt));
        if (matchingTokens.length >= 2) {
          score += 45;
          reasons.push(`Name tokens match "${matchingTokens.join(' ')}"`);
        } else if (matchingTokens.length === 1 && guestTokens.length === 1) {
          score += 25;
          reasons.push(`Guest surname match "${matchingTokens[0]}"`);
        }
      }
    }

    // 3. Amount Proximity
    const netDiff = Math.abs((ota.net_payout_cents || toCents(ota.net_payout)) - rowAmountCents);
    const grossDiff = Math.abs((ota.gross_amount_cents || toCents(ota.gross_amount)) - rowAmountCents);

    if (netDiff === 0) {
      score += 40;
      reasons.push(`Exact Net Payout match ($${(rowAmountCents / 100).toFixed(2)})`);
    } else if (netDiff <= 200) {
      score += 25;
      reasons.push(`Net payout within $2.00`);
    } else if (grossDiff === 0) {
      score += 35;
      reasons.push(`Exact Gross Booking match ($${(rowAmountCents / 100).toFixed(2)})`);
    }

    // 4. Date Proximity (within ±14 days)
    if (rowDate) {
      const otaDateStr = ota.payout_date || ota.check_in_date;
      if (otaDateStr) {
        const [ry, rm, rd] = rowDate.split('-').map(Number);
        const [oy, om, od] = otaDateStr.split('-').map(Number);
        const rTime = new Date(ry, rm - 1, rd).getTime();
        const oTime = new Date(oy, om - 1, od).getTime();
        const daysDiff = Math.abs(rTime - oTime) / (86400 * 1000);

        if (daysDiff <= 3) {
          score += 20;
          reasons.push(`Within ${Math.round(daysDiff)} days of stay/payout`);
        } else if (daysDiff <= 14) {
          score += 10;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = ota;
      matchReason = reasons.join(', ');
    }
  }

  // Evaluate Score Thresholds
  if (bestMatch && bestScore >= 45) {
    return {
      booking: bestMatch,
      confidence: bestScore >= 70 ? 'HIGH' : 'MEDIUM',
      reason: matchReason,
      isAlreadyRecognized: false,
      suggestedMode: 'MATCHED_OTA'
    };
  }

  // No match found -> Direct Rental Income
  return {
    booking: null,
    confidence: 'NONE',
    reason: 'No matching OTA reservation found. Appears to be direct guest booking or direct rental revenue.',
    isAlreadyRecognized: false,
    suggestedMode: 'DIRECT_INCOME'
  };
}
