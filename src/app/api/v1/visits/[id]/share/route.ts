import QRCode from 'qrcode';
import { ok, staff } from '@/server/http';
import { activeLinkToken, patientUrl } from '@/server/services/issue';

export const GET = staff<{ id: string }>('link.manage', async ({ params }) => {
  const token = await activeLinkToken(params.id);
  if (!token) return ok({ url: null, qr: null });
  const url = patientUrl(token);
  const qr = await QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#ffffff00' } });
  return ok({ url, qr });
});
