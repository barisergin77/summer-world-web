// Contact form → email to Baris (owner 2026-11-09). Vercel Node function.
// Sends via Resend from a verified sender domain; the visitor's address goes in reply_to.
// Env: RESEND_API_KEY, CONTACT_TO (default baris@summerworld.club), CONTACT_FROM.
const TO = process.env.CONTACT_TO || 'baris@summerworld.club';
const FROM = process.env.CONTACT_FROM || 'Summer World website <forms@straudits.com>';

const clean = (v, max) => String(v ?? '').replace(/\r/g, '').trim().slice(0, max);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Anti-spam (owner 2026-11-12: bots sending gibberish like "FyZPuMLwhetIQrgpdlWg").
// Bots that POST straight to the API lack the js/elapsed fields the page adds.
const gibberish = (v) => {
  v = String(v || '').trim();
  if (v.length < 8 || /\s/.test(v)) return false;
  const caseFlips = (v.match(/[a-z][A-Z]|[A-Z][a-z]/g) || []).length;
  return caseFlips >= 4 || !/[aeiouy]/i.test(v);
};
function spamReason(b) {
  if (b.js !== 'sw1') return 'no-js';
  if (!(Number(b.elapsed) >= 4000)) return 'too-fast';
  if (gibberish(b.name)) return 'gibberish-name';
  const msg = String(b.message || '').trim();
  if (/^[\d\s+()-]*$/.test(msg)) return 'number-only-message';
  const local = String(b.email || '').split('@')[0];
  if (/@gmail\.com$/i.test(b.email || '') && (local.match(/\./g) || []).length >= 3) return 'dotted-gmail';
  return '';
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
  b = b || {};
  if (b['bot-field']) return res.status(200).json({ ok: true }); // honeypot: pretend success
  const why = spamReason(b);
  if (why) { console.log('spam dropped:', why); return res.status(200).json({ ok: true }); } // pretend success
  const name = clean(b.name, 120), email = clean(b.email, 200), company = clean(b.company, 160);
  const service = clean(b.service, 80), message = clean(b.message, 5000), lang = clean(b.lang, 5);
  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ ok: false, error: 'invalid' });
  if (!process.env.RESEND_API_KEY) return res.status(500).json({ ok: false, error: 'not-configured' });

  const lines = [`Name: ${name}`, `Email: ${email}`, company && `Company: ${company}`, service && `Interest: ${service}`, lang && `Page language: ${lang}`, '', message].filter((x) => x !== '' && x);
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: [TO],
      reply_to: email,
      subject: `Summer World enquiry from ${name}${service ? ` (${service})` : ''}`,
      text: lines.join('\n'),
      html: `<pre style="font:14px/1.5 -apple-system,Segoe UI,sans-serif;white-space:pre-wrap">${esc(lines.join('\n'))}</pre>`,
    }),
  });
  if (!r.ok) { console.error('resend', r.status, await r.text()); return res.status(502).json({ ok: false }); }
  return res.status(200).json({ ok: true });
};
