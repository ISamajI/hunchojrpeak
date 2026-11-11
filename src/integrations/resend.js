// Resend email API. Only ever called from approval executors.
import { env } from '../config.js';
import { requestJson } from './http.js';

export async function sendEmail({ to, subject, text, replyTo }) {
  const key = env('RESEND_API_KEY');
  const from = env('OUTREACH_FROM_EMAIL');
  if (!key || !from) throw new Error('RESEND_API_KEY and OUTREACH_FROM_EMAIL must be set to send email');
  const base = env('RESEND_API_URL', 'https://api.resend.com');
  const data = await requestJson(`${base}/emails`, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}` },
    body: { from, to: [to], subject, text, ...(replyTo ? { reply_to: replyTo } : {}) },
  });
  if (!data?.id) throw new Error('Resend response did not include a message id');
  return { id: data.id };
}
