'use client';
import { amountInWords, todayIST } from './utils';

export interface HRAData {
  tenantName: string;
  ownerName: string;
  pgName: string;
  pgAddress: string;
  bedId: string;
  amount: number;
  monthYear: string;
  paidDate: string;
}

export async function generateHRAReceipt(data: HRAData): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 20;

  // Header background banner
  doc.setFillColor(99, 102, 241); // indigo-500
  doc.rect(0, 0, pageW, 40, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('HOUSE RENT ALLOWANCE (HRA) RECEIPT', margin, 18);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Form 12BB Proof of Rent Paid | Income Tax Act, 1961', margin, 27);
  doc.text(`Receipt Generation Date: ${data.paidDate || todayIST()}`, margin, 34);

  // PG & Landlord Details Box
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, 50, pageW - 2 * margin, 38, 3, 3, 'FD');

  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(data.pgName || 'Paying Guest Accommodation', margin + 6, 60);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Address: ${data.pgAddress || 'Not Specified'}`, margin + 6, 67, {
    maxWidth: pageW - 2 * margin - 12,
  });
  doc.text(`Owner / Landlord Name: ${data.ownerName || 'Property Owner'}`, margin + 6, 75);

  // Rent Details Table Header
  const tableY = 98;
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, tableY, pageW - 2 * margin, 10, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text('DESCRIPTION', margin + 6, tableY + 6.5);
  doc.text('DETAILS', margin + 70, tableY + 6.5);

  const rows = [
    ['Resident Name', data.tenantName],
    ['Bed & Room Assignment', data.bedId],
    ['Rent Billing Period', data.monthYear],
    ['Total Rent Paid', `INR ${data.amount.toLocaleString('en-IN')}/-`],
    ['Amount in Words', `${amountInWords(data.amount)} Rupees Only`],
    ['Payment Date', data.paidDate || 'Paid in Full'],
    ['Mode of Payment', 'Verified Digital UPI / Bank Transfer'],
  ];

  let currentY = tableY + 10;
  rows.forEach(([label, value], i) => {
    doc.setFillColor(i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 250);
    doc.rect(margin, currentY, pageW - 2 * margin, 11, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(label, margin + 6, currentY + 7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(String(value), margin + 70, currentY + 7);
    currentY += 11;
  });

  // Revenue Stamp simulation box & Signature
  const stampY = currentY + 12;
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, stampY, 35, 25, 2, 2, 'D');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('AFFIX REVENUE', margin + 4, stampY + 10);
  doc.text('STAMP (Rs 1/-)', margin + 5, stampY + 15);
  doc.text('IF > Rs 5,000', margin + 7, stampY + 20);

  // Digital acknowledgment signature line
  doc.setDrawColor(99, 102, 241);
  doc.line(pageW - margin - 60, stampY + 18, pageW - margin, stampY + 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(data.ownerName || 'Authorized Landlord', pageW - margin - 60, stampY + 23);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Landlord / Caretaker Signature', pageW - margin - 60, stampY + 27);

  // Declaration Notice
  const noticeY = stampY + 38;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, noticeY, pageW - 2 * margin, 24, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Declaration: This computer-generated receipt serves as documented evidence for claiming HRA tax exemption under Section 10(13A) of the Income Tax Act. Please attach this along with your rent agreement and landlord PAN copy as requested by your employer.',
    margin + 4,
    noticeY + 6,
    { maxWidth: pageW - 2 * margin - 8 }
  );

  // Bottom footer
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 282, pageW, 15, 'F');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('PGPass | Zero-Cost PG Rent & Bed Management | https://pgpass.in', margin, 290);

  doc.save(`HRA_Receipt_${data.tenantName.replace(/\s+/g, '_')}_${data.monthYear}.pdf`);
}
