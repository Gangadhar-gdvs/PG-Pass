import { describe, it, expect } from 'vitest';
import {
  extractUtrFromNarration,
  parseBankStatementCsv,
  matchBankTransactions,
} from '@/lib/client/bankCsv';

describe('Bank Statement CSV Matcher & UTR Parser', () => {
  describe('extractUtrFromNarration', () => {
    it('should extract 12-digit UTR from standard UPI narration', () => {
      const narration = 'UPI/432198765432/Payment from Rahul/HDFC';
      expect(extractUtrFromNarration(narration)).toBe('432198765432');
    });

    it('should extract 12-digit UTR from IMPS narration format', () => {
      const narration = 'IMPS-412345678901-RAHUL SHARMA-RENT';
      expect(extractUtrFromNarration(narration)).toBe('412345678901');
    });

    it('should extract standalone 12-digit reference number', () => {
      const narration = 'CR TRANSFER BY 498765432109 RENT APR';
      expect(extractUtrFromNarration(narration)).toBe('498765432109');
    });

    it('should return undefined if narration has no 12-digit number', () => {
      const narration = 'CASH DEPOSIT BRANCH 402';
      expect(extractUtrFromNarration(narration)).toBeUndefined();
    });
  });

  describe('parseBankStatementCsv', () => {
    it('should parse credit entries and clean comma-formatted amounts', () => {
      const csv = `Date,Narration,Chq/Ref No,Value Dt,Withdrawal Amt,Deposit Amt,Closing Balance
01/04/2026,"UPI/432198765432/Rent Bed 101/Paytm",432198765432,01/04/2026,,"8,500.00","25,000.00"
02/04/2026,"ATM CASH WDL",,02/04/2026,"2,000.00",,"23,000.00"
03/04/2026,"UPI/512345678901/Monthly Rent",512345678901,03/04/2026,,"9,000.00","32,000.00"`;

      const txs = parseBankStatementCsv(csv);
      expect(txs.length).toBe(2);
      expect(txs[0].creditAmount).toBe(8500);
      expect(txs[0].utr).toBe('432198765432');
      expect(txs[1].creditAmount).toBe(9000);
      expect(txs[1].utr).toBe('512345678901');
    });

    it('should handle empty or malformed CSV gracefully', () => {
      expect(parseBankStatementCsv('')).toEqual([]);
      expect(parseBankStatementCsv('Just one line')).toEqual([]);
    });
  });

  describe('matchBankTransactions', () => {
    it('should prioritize exact UTR match over generic amount match', () => {
      const transactions = [
        {
          id: 'tx_1',
          date: '01/04/2026',
          narration: 'UPI/432198765432/Rent',
          utr: '432198765432',
          creditAmount: 8500,
        },
      ];

      const rentRecords = [
        {
          id: 'rec_amount_only',
          tenantName: 'Vikram',
          amountDuePaise: 850000,
          status: 'pending',
          paymentReference: undefined,
        },
        {
          id: 'rec_exact_utr',
          tenantName: 'Rahul',
          amountDuePaise: 850000,
          status: 'pending',
          paymentReference: '432198765432',
        },
      ];

      const matches = matchBankTransactions(transactions, rentRecords);
      expect(matches.length).toBe(1);
      expect(matches[0].confidence).toBe('exact_utr');
      expect(matches[0].rentRecord?.id).toBe('rec_exact_utr');
    });

    it('should fallback to amount match when UTR is not present on rent record', () => {
      const transactions = [
        {
          id: 'tx_2',
          date: '02/04/2026',
          narration: 'NEFT TRANSFER FROM ANAND',
          utr: undefined,
          creditAmount: 7500,
        },
      ];

      const rentRecords = [
        {
          id: 'rec_anand',
          tenantName: 'Anand',
          amountDuePaise: 750000,
          status: 'pending',
        },
      ];

      const matches = matchBankTransactions(transactions, rentRecords);
      expect(matches.length).toBe(1);
      expect(matches[0].confidence).toBe('amount_match');
      expect(matches[0].rentRecord?.id).toBe('rec_anand');
    });

    it('should not match already paid rent records', () => {
      const transactions = [
        {
          id: 'tx_3',
          date: '03/04/2026',
          narration: 'UPI/999999999999/Rent',
          utr: '999999999999',
          creditAmount: 8500,
        },
      ];

      const rentRecords = [
        {
          id: 'rec_paid',
          tenantName: 'Paid Resident',
          amountDuePaise: 850000,
          status: 'paid',
          paymentReference: '999999999999',
        },
      ];

      const matches = matchBankTransactions(transactions, rentRecords);
      expect(matches.length).toBe(1);
      expect(matches[0].confidence).toBe('unmatched');
      expect(matches[0].rentRecord).toBeUndefined();
    });
  });
});
