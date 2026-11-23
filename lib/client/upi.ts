export interface UpiPaymentDetails {
  upiId: string;
  merchantName?: string;
  amountPaise: number;
  transactionNote?: string;
}

export function buildUpiPayload({
  upiId,
  merchantName = 'PG Accommodation',
  amountPaise,
  transactionNote = 'Rent Payment',
}: UpiPaymentDetails): string {
  const amountRupees = (amountPaise / 100).toFixed(2);
  const params = new URLSearchParams({
    pa: upiId.trim(),
    pn: merchantName.trim(),
    am: amountRupees,
    cu: 'INR',
    tn: transactionNote.trim(),
  });
  return `upi://pay?${params.toString()}`;
}

export function buildWaReminderLink(phone: string, text: string): string {
  const cleaned = phone.replace(/\D/g, '');
  const phone10 = cleaned.length > 10 ? cleaned.slice(-10) : cleaned;
  const encodedText = encodeURIComponent(text);
  return `https://wa.me/91${phone10}?text=${encodedText}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
