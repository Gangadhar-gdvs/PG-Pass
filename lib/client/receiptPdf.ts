'use client';
import { RentRecord, Owner } from '@/types';
import { amountInWords, tsToDate } from '@/lib/utils';

export interface NumberedReceiptData {
  owner: Owner;
  tenantName: string;
  tenantPhone?: string;
  record: RentRecord;
}

/**
 * Client-side numbered receipt generator built exclusively from verified 'paid' records.
 * Uses the server-assigned receiptNumber and snapshotted roomNumber & bedLabel.
 */
export async function generateNumberedReceipt(data: NumberedReceiptData): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 18;

  const { owner, tenantName, record } = data;
  const receiptNum = record.receiptNumber
    ? `REC-${String(record.receiptNumber).padStart(5, '0')}`
    : `REC-TEMP`;

  const amountRupees = Math.round((record.amountPaidPaise || record.amountDuePaise || 0) / 100);

  // Top header banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageW, 36, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('RENT PAYMENT RECEIPT', margin, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Receipt No: ${receiptNum}  |  Period: ${record.period}`, margin, 27);
  doc.text(`Date of Confirmation: ${tsToDate(record.confirmedAt)?.toLocaleDateString('en-IN') ?? 'Verified'}`, margin, 32);

  // PG Details Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, 44, pageW - 2 * margin, 32, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(owner.pgName || 'PG Accommodation', margin + 6, 52);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Address: ${owner.address || owner.pgAddress || 'Not specified'}`, margin + 6, 58, {
    maxWidth: pageW - 2 * margin - 12,
  });
  doc.text(`Owner: ${owner.name}  |  UPI: ${owner.upiId || 'N/A'}`, margin + 6, 65);

  // Resident & Room Info Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, 82, pageW - 2 * margin, 22, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`Tenant: ${tenantName}`, margin + 6, 91);
  doc.setFont('helvetica', 'normal');
  doc.text(`Room: ${record.roomNumber}  |  Bed: ${record.bedLabel}`, margin + 6, 98);

  // Line Items Table
  const tableY = 112;
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, tableY, pageW - 2 * margin, 8, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('LINE ITEM', margin + 6, tableY + 5.5);
  doc.text('AMOUNT (INR)', pageW - margin - 35, tableY + 5.5);

  let currentY = tableY + 8;
  const items = record.lineItems && record.lineItems.length > 0
    ? record.lineItems
    : [{ label: 'Monthly Rent', amountPaise: record.amountPaidPaise || record.amountDuePaise || 0 }];

  items.forEach((item, i) => {
    doc.setFillColor(i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 250);
    doc.rect(margin, currentY, pageW - 2 * margin, 9, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(item.label, margin + 6, currentY + 6);
    const amountVal = (item.amountPaise || 0) / 100;
    doc.text(`₹ ${amountVal.toLocaleString('en-IN')}`, pageW - margin - 35, currentY + 6);
    currentY += 9;
  });

  // Total summary row
  doc.setFillColor(226, 232, 240);
  doc.rect(margin, currentY, pageW - 2 * margin, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL PAID IN FULL', margin + 6, currentY + 6.5);
  doc.text(`₹ ${amountRupees.toLocaleString('en-IN')}/-`, pageW - margin - 35, currentY + 6.5);
  currentY += 16;

  // Words & reference
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Amount in words: ${amountInWords(amountRupees)} Rupees Only`, margin, currentY);
  currentY += 6;
  if (record.paymentReference) {
    doc.text(`UPI / Bank Reference (UTR): ${record.paymentReference}`, margin, currentY);
    currentY += 6;
  }

  // Footer / Verification notice
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'This is a computer-generated, tamper-evident digital receipt issued via PG-Pass platform.',
    margin,
    270
  );

  doc.save(`${receiptNum}_${record.period}_${tenantName.replace(/\s+/g, '_')}.pdf`);
}
