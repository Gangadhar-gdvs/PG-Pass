// `qrcode` (~100 KB) is dynamically imported so it is code-split out of the
// initial bundle and only fetched when a QR is actually rendered (tenant portal
// "Show QR" / billing upgrade), instead of shipping to every page that imports
// this helper.
export async function generateQrDataUrl(text: string): Promise<string> {
  try {
    const { default: QRCode } = await import('qrcode');
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
