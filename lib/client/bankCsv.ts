'use client';

import type { RentRecord } from '@/types';

/**
 * The subset of a rent record the bank-statement reconciler reads. Derived from
 * the real `RentRecord` domain type (not `any`) but widened to the handful of
 * fields the matcher touches — and `status` is accepted as a plain string so
 * loosely-shaped/partial callers (owner dashboard rows, test fixtures) can be
 * passed without an `any` escape hatch.
 */
export interface ReconcilableRentRecord {
  id?: string;
  status?: string;
  paymentReference?: RentRecord['paymentReference'];
  amountDuePaise?: RentRecord['amountDuePaise'];
  amount?: RentRecord['amount'];
  tenantName?: RentRecord['tenantName'];
  bedLabel?: RentRecord['bedLabel'];
}

export interface BankTransaction {
  id: string;
  date: string;
  narration: string;
  utr?: string;
  creditAmount: number; // in rupees
}

export interface ReconcileMatch {
  transaction: BankTransaction;
  rentRecord?: ReconcilableRentRecord;
  confidence: 'exact_utr' | 'amount_match' | 'unmatched';
}

/**
 * Extracts 12-digit Indian banking UPI/IMPS UTR numbers from narration text.
 */
export function extractUtrFromNarration(narration: string): string | undefined {
  if (!narration) return undefined;
  // Match standard 12-digit sequence in UPI/IMPS/NEFT remarks
  const match = narration.match(/(?:UPI|UTR|IMPS|REF|CR|P2A)[/: -]*([0-9]{12})\b/i) ||
    narration.match(/\b([0-9]{12})\b/);
  return match ? match[1] : undefined;
}

/**
 * Parses generic Indian bank statement CSVs (HDFC, ICICI, SBI, Axis, Paytm, Kotak).
 */
export function parseBankStatementCsv(csvText: string): BankTransaction[] {
  if (!csvText || typeof csvText !== 'string') return [];

  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  // Find header line
  let headerIndex = -1;
  let headers: string[] = [];

  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cols = lines[i].split(',').map((c) => c.replace(/["']/g, '').trim().toLowerCase());
    if (
      cols.some((c) => c.includes('date') || c.includes('txn date')) &&
      cols.some((c) => c.includes('narration') || c.includes('description') || c.includes('particular')) &&
      cols.some((c) => c.includes('credit') || c.includes('deposit') || c.includes('amount'))
    ) {
      headerIndex = i;
      headers = cols;
      break;
    }
  }

  // Fallback to row 0 if no explicit header detected
  if (headerIndex === -1) {
    headerIndex = 0;
    headers = lines[0].split(',').map((c) => c.replace(/["']/g, '').trim().toLowerCase());
  }

  const dateIdx = headers.findIndex((h) => h.includes('date') || h.includes('txn date'));
  const descIdx = headers.findIndex(
    (h) => h.includes('narration') || h.includes('description') || h.includes('particular') || h.includes('remarks')
  );
  let creditIdx = headers.findIndex((h) => h.includes('credit') || h.includes('deposit'));
  if (creditIdx === -1) {
    creditIdx = headers.findIndex((h) => h === 'amount');
  }

  const transactions: BankTransaction[] = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    // Regex CSV line split respecting quotes
    const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((val) =>
      val.replace(/^"|"$/g, '').trim()
    );

    if (row.length < 3) continue;

    const rawDate = dateIdx !== -1 ? row[dateIdx] : '';
    const narration = descIdx !== -1 ? row[descIdx] : '';
    const rawCredit = creditIdx !== -1 ? row[creditIdx] : '';

    // Clean currency string (e.g. " 8,500.00 " -> 8500)
    const cleanedAmount = parseFloat(rawCredit.replace(/[^\d.]/g, ''));

    if (isNaN(cleanedAmount) || cleanedAmount <= 0) {
      continue; // Skip withdrawals or non-numeric rows
    }

    const utr = extractUtrFromNarration(narration);

    transactions.push({
      id: `tx_${i}_${Date.now()}`,
      date: rawDate,
      narration,
      utr,
      creditAmount: Math.round(cleanedAmount),
    });
  }

  return transactions;
}

/**
 * Matches extracted bank credits against pending / verify rent records.
 */
export function matchBankTransactions(
  transactions: BankTransaction[],
  rentRecords: ReconcilableRentRecord[]
): ReconcileMatch[] {
  const matches: ReconcileMatch[] = [];
  const claimedRecordIds = new Set<string>();

  for (const tx of transactions) {
    let matchedRecord: ReconcilableRentRecord | undefined;
    let confidence: 'exact_utr' | 'amount_match' | 'unmatched' = 'unmatched';

    // 1. Exact UTR match (Highest priority)
    if (tx.utr) {
      matchedRecord = rentRecords.find(
        (r) =>
          !(r.id != null && claimedRecordIds.has(r.id)) &&
          r.status !== 'paid' &&
          r.paymentReference &&
          r.paymentReference.trim().toUpperCase() === tx.utr!.toUpperCase()
      );
      if (matchedRecord) {
        confidence = 'exact_utr';
      }
    }

    // 2. Amount match on pending/verify record if no UTR matched
    if (!matchedRecord) {
      matchedRecord = rentRecords.find((r) => {
        if ((r.id != null && claimedRecordIds.has(r.id)) || r.status === 'paid') return false;
        const dueRupees = r.amountDuePaise ? Math.round(r.amountDuePaise / 100) : r.amount;
        return dueRupees === tx.creditAmount;
      });
      if (matchedRecord) {
        confidence = 'amount_match';
      }
    }

    if (matchedRecord?.id != null) {
      claimedRecordIds.add(matchedRecord.id);
    }

    matches.push({
      transaction: tx,
      rentRecord: matchedRecord,
      confidence,
    });
  }

  return matches;
}
