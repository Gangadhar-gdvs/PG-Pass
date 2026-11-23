import QRCode from 'qrcode';

export async function generateQrDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#09090B',
        light: '#FFFFFF',
      },
    });
  } catch (err) {
    console.error('Failed to generate QR code locally:', err);
    return '';
  }
}
