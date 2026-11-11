// Twilio SMS + voice for owner alerts (critical notifications only).
// These message the owner's own phone, never prospects.
import { env } from '../config.js';
import { requestJson } from './http.js';

function creds() {
  const sid = env('TWILIO_ACCOUNT_SID');
  const token = env('TWILIO_AUTH_TOKEN');
  const from = env('TWILIO_FROM_NUMBER');
  const to = env('OWNER_PHONE');
  if (!sid || !token || !from || !to) throw new Error('Twilio not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, OWNER_PHONE)');
  return { sid, token, from, to, base: env('TWILIO_API_URL', 'https://api.twilio.com') };
}

async function post(path, form) {
  const c = creds();
  return requestJson(`${c.base}/2010-04-01/Accounts/${encodeURIComponent(c.sid)}/${path}`, {
    method: 'POST',
    headers: {
      authorization: 'Basic ' + Buffer.from(`${c.sid}:${c.token}`).toString('base64'),
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: c.from, To: c.to, ...form }).toString(),
  });
}

export async function sendSms(text) {
  const r = await post('Messages.json', { Body: text.slice(0, 1500) });
  return { sid: r.sid };
}

export async function placeCall(text) {
  const safe = text.replace(/[<>&"']/g, ' ').slice(0, 500);
  const r = await post('Calls.json', { Twiml: `<Response><Say>${safe}</Say></Response>` });
  return { sid: r.sid };
}
