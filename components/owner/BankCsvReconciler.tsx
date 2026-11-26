'use client';

import React, { useState, useRef } from 'react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import {
  parseBankStatementCsv,
  matchBankTransactions,
  ReconcileMatch,
  type ReconcilableRentRecord,
} from '@/lib/client/bankCsv';
import {
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface BankCsvReconcilerProps {
  isOpen: boolean;
  onClose: () => void;
  rentRecords: ReconcilableRentRecord[];
  onComplete?: () => void;
}

export function BankCsvReconciler({
  isOpen,
  onClose,
  rentRecords,
  onComplete,
}: BankCsvReconcilerProps) {
  const [matches, setMatches] = useState<ReconcileMatch[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [parsing, setParsing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      toast.error('Please upload a valid bank statement CSV file');
      return;
    }

    setParsing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const txs = parseBankStatementCsv(text);
        if (txs.length === 0) {
          toast.error('Could not detect any credit transactions in this CSV');
          setParsing(false);
          return;
        }

        const matched = matchBankTransactions(txs, rentRecords);
        setMatches(matched);

        // Pre-select all exact UTR matches
        const exactMatchIds = new Set<string>();
        matched.forEach((m) => {
          if (m.confidence === 'exact_utr' && m.rentRecord?.id) {
            exactMatchIds.add(m.rentRecord.id);
          }
        });
        setSelectedIds(exactMatchIds);

        toast.success(`Parsed ${txs.length} bank entries · ${exactMatchIds.size} high-confidence matches`);
      } catch (err: unknown) {
        console.error('CSV Parsing error:', err);
        toast.error('Failed to parse statement format');
      } finally {
        setParsing(false);
      }
    };
    reader.readAsText(file);
  };

  const toggleSelection = (recordId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) {
        next.delete(recordId);
      } else {
        next.add(recordId);
      }
      return next;
    });
  };

  const handleBatchConfirm = async () => {
    if (selectedIds.size === 0) return;

    setConfirming(true);
    let successCount = 0;
    try {
      const promises = Array.from(selectedIds).map(async (recordId) => {
        const match = matches.find((m) => m.rentRecord?.id === recordId);
        const ref = match?.transaction.utr || match?.rentRecord?.paymentReference || 'Bank CSV matched';

        const res = await fetch(`/api/rent/${recordId}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentReference: ref,
          }),
        });
        if (res.ok) successCount++;
      });

      await Promise.all(promises);
      toast.success(`Successfully confirmed ${successCount} rent payments!`);
      onComplete?.();
      onClose();
    } catch {
      toast.error('Some payments failed to confirm');
    } finally {
      setConfirming(false);
    }
  };

  const matchedItems = matches.filter((m) => m.confidence !== 'unmatched');

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Bank Statement Reconciliation (CSV)"
      description="Automatically match UPI bank credits against pending resident rent records"
      width="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="outline" size="sm" onClick={onClose} disabled={confirming}>
            Cancel
          </Button>

          {matchedItems.length > 0 && (
            <Button
              variant="solid"
              size="sm"
              loading={confirming}
              disabled={selectedIds.size === 0}
              onClick={handleBatchConfirm}
              className="bg-[#10B981] hover:bg-[#059669] text-white"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              <span>Confirm & Issue Receipts ({selectedIds.size})</span>
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5 text-left">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".csv,text/csv"
          className="hidden"
        />

        {matches.length === 0 ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#CBD5E1] hover:border-[color:var(--accent)] bg-[#F8FAFC] hover:bg-white rounded-[12px] p-8 text-center transition-all cursor-pointer group space-y-2"
          >
            <div className="w-12 h-12 rounded-full accent-soft-bg accent-text flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-[#09090B] block">
              {parsing ? 'Parsing Statement Columns...' : 'Upload Bank Statement CSV'}
            </span>
            <p className="text-xs text-[#64748B] max-w-sm mx-auto">
              Export your statement from HDFC, ICICI, SBI, Axis, or Paytm Bank and drop it here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#09090B]">
                Matched Transactions ({matchedItems.length} found)
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs accent-text font-semibold hover:underline inline-flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Upload Another CSV</span>
              </button>
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-[10px] divide-y divide-[#E2E8F0] max-h-96 overflow-y-auto">
              {matchedItems.map((m, idx) => {
                const rec = m.rentRecord;
                const isSelected = rec?.id ? selectedIds.has(rec.id) : false;

                return (
                  <div
                    key={idx}
                    onClick={() => rec?.id && toggleSelection(rec.id)}
                    className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#ECFDF5]' : 'hover:bg-[#F8FAFC]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Controlled via parent div onClick
                      className="mt-1 h-4 w-4 rounded border-[#CBD5E1] text-[#10B981] focus:ring-[#10B981] cursor-pointer"
                    />

                    <div className="flex-1 min-w-0 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#09090B]">
                            {rec?.tenantName || rec?.bedLabel || 'Resident'}
                          </span>
                          <span
                            className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-[4px] ${
                              m.confidence === 'exact_utr'
                                ? 'bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]'
                                : 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]'
                            }`}
                          >
                            {m.confidence === 'exact_utr' ? 'Exact UTR Match' : 'Amount Match'}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-[#09090B]">
                          {formatCurrency(m.transaction.creditAmount)}
                        </span>
                      </div>

                      <div className="text-[11px] text-[#64748B] flex items-center justify-between">
                        <span className="font-mono truncate max-w-[280px]">
                          {m.transaction.narration}
                        </span>
                        <span>{m.transaction.date}</span>
                      </div>

                      {m.transaction.utr && (
                        <div className="text-[10px] text-[#047857] font-mono">
                          Extracted UTR: <strong>{m.transaction.utr}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
