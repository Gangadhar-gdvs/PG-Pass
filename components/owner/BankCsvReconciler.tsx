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
import { Badge } from '@/components/ui/badge';
import { KeyValue, SectionHeader } from '@/components/ui/dashboard-kit';
import { Icon3D, IconBubble } from '@/components/brand/Icon3D';
import {
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  Loader2,
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
  const [dragging, setDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so choosing the same file again still fires onChange.
    e.target.value = '';
    if (file) processFile(file);
  };

  // Drag-and-drop onto the upload zone (the copy has always said "drop it here").
  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setDragging(false);
    if (parsing) return;
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };
  const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!dragging) setDragging(true);
  };

  const processFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv') && file.type !== 'text/csv') {
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
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="outline" onClick={onClose} disabled={confirming} className="w-full sm:w-auto">
            Cancel
          </Button>

          {matchedItems.length > 0 && (
            <Button
              variant="success"
              loading={confirming}
              disabled={selectedIds.size === 0}
              onClick={handleBatchConfirm}
              className="w-full sm:w-auto"
            >
              {!confirming && <CheckCircle2 className="h-4 w-4" />}
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
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={handleDragOver}
            onDragOver={handleDragOver}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            aria-busy={parsing}
            className={`group flex w-full flex-col items-center rounded-[22px] border-2 border-dashed px-5 py-8 text-center transition-all hover:border-brand-300 hover:bg-white/80 press sm:py-10 animate-pop ${
              dragging ? 'border-brand bg-white shadow-[0_0_0_4px_rgba(123,63,242,0.14)]' : 'border-brand-200 bg-brand-50/60'
            }`}
          >
            <span
              className="icon-bubble tint-violet mb-4 transition-transform group-hover:scale-105"
              style={{ width: 80, height: 80 }}
            >
              <Icon3D name="report" size={48} />
            </span>
            <span className="block text-base font-extrabold tracking-[-0.01em] text-ink">
              {parsing ? 'Parsing Statement Columns...' : dragging ? 'Drop the CSV to upload' : 'Upload Bank Statement CSV'}
            </span>
            <span className="mx-auto mt-1.5 block max-w-sm text-[13px] font-medium leading-relaxed text-muted">
              Export your statement from HDFC, ICICI, SBI, Axis, or Paytm Bank and drop it here.
            </span>
            <span className="btn-pill mt-5 h-11 text-[13.5px]">
              {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Choose CSV file
            </span>
          </button>
        ) : (
          <div className="space-y-4">
            <SectionHeader
              title="Matched Transactions"
              icon="check"
              className="flex-wrap"
              action={
                <Button variant="soft" onClick={() => fileInputRef.current?.click()}>
                  <RefreshCw className="h-4 w-4" />
                  <span>Upload Another CSV</span>
                </Button>
              }
            />

            {/* Summary */}
            <div className="well divide-y divide-line px-3.5 py-1">
              <KeyValue label="Matched transactions" value={`${matchedItems.length} found`} />
              <KeyValue
                label="Exact UTR matches"
                value={matchedItems.filter((m) => m.confidence === 'exact_utr').length}
              />
              <KeyValue label="Selected to confirm" value={<span className="text-success-ink">{selectedIds.size}</span>} />
            </div>

            <div className="app-card max-h-96 divide-y divide-line overflow-y-auto overscroll-contain">
              {matchedItems.map((m, idx) => {
                const rec = m.rentRecord;
                const isSelected = rec?.id ? selectedIds.has(rec.id) : false;
                const exact = m.confidence === 'exact_utr';

                return (
                  <div
                    key={idx}
                    onClick={() => rec?.id && toggleSelection(rec.id)}
                    className={`flex items-start gap-3 px-3 py-3 transition-colors cursor-pointer sm:px-4 ${
                      isSelected ? 'bg-success-bg/70' : 'hover:bg-lilac'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Controlled via parent div onClick
                      className="mt-3 h-5 w-5 shrink-0 cursor-pointer"
                    />

                    <IconBubble icon={exact ? 'check' : 'alert'} tint={exact ? 'mint' : 'peach'} size={40} />

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate text-[14px] font-bold text-ink">
                            {rec?.tenantName || rec?.bedLabel || 'Resident'}
                          </span>
                          <Badge variant={exact ? 'paid' : 'pending'}>
                            {exact ? 'Exact UTR Match' : 'Amount Match'}
                          </Badge>
                        </div>
                        <span className="shrink-0 text-[14px] font-extrabold font-mono-numbers text-ink">
                          {formatCurrency(m.transaction.creditAmount)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted">
                        <span className="min-w-0 truncate font-mono">{m.transaction.narration}</span>
                        <span className="shrink-0 font-mono-numbers">{m.transaction.date}</span>
                      </div>

                      {m.transaction.utr && (
                        <div className="text-[11.5px] font-medium text-success-ink">
                          Extracted UTR: <strong className="font-mono">{m.transaction.utr}</strong>
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
