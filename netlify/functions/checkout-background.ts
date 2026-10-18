import type { Handler } from '@netlify/functions';
import { deliverOrder, verifyInternalSignature, ValidOrder } from '../../server/checkout.server';

// Background functions may run up to 15 minutes: the sheet (main order record) gets a patient
// retry schedule instead of Netlify re-running the whole function (which would duplicate Telegram).
const SHEET_RETRY_DELAYS_MS = [0, 1000, 3000, 8000, 20000, 45000];

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const signature = event.headers['x-tamam-signature'] || event.headers['X-Tamam-Signature'];
  if (!verifyInternalSignature(event.body || '', signature)) {
    console.warn('Rejected unsigned call to checkout-background');
    return { statusCode: 401, body: 'Unauthorized' };
  }
  try {
    const order = JSON.parse(event.body || '{}') as ValidOrder;
    if (!order.orderId || !order.name || !order.phone) return { statusCode: 400, body: 'Missing order fields' };
    const result = await deliverOrder(order, { sheetDelays: SHEET_RETRY_DELAYS_MS });
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    console.error('[checkout-background] failed:', err);
    // No throw/500 on purpose: a re-run would resend Telegram and the Purchase event
    return { statusCode: 200, body: JSON.stringify({ error: 'failed' }) };
  }
};
