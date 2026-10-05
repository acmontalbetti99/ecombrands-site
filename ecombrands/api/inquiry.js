/**
 * POST /api/inquiry — turns a form submission into an email.
 *
 * Runs as a Vercel Serverless Function. No npm dependencies: it calls the
 * Resend REST API with the global fetch that Node 18+ provides, so there is
 * nothing to install and nothing to keep patched.
 *
 * Environment variables (set in Vercel → Settings → Environment Variables):
 *   RESEND_API_KEY   required   re_xxxxxxxx from resend.com/api-keys
 *   INQUIRY_TO       optional   where inquiries land. Default hello@ecombrands.us
 *   INQUIRY_FROM     optional   verified sender. Default Ecombrands <noreply@send.ecombrands.us>
 *   INQUIRY_BCC      optional   blind copy, comma-separated. Unset = no copy.
 *
 * The visitor's address goes into Reply-To, so answering an inquiry is just
 * hitting reply — never copy-pasting an address out of the body.
 *
 * INQUIRY_BCC is a blind copy in the real sense: it travels in the envelope,
 * not in a header, so nobody who fills in the form can see it. Leave the
 * variable unset and the key disappears from the payload entirely.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const LIMIT_WINDOW_MS = 60_000;
const LIMIT_MAX = 5;
const hits = new Map(); // per warm instance only — see README on its limits

function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < LIMIT_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 500) hits.clear();
  return recent.length > LIMIT_MAX;
}

// strip control characters so nothing can inject headers, then bound the length
const clean = (v, max) =>
  String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max);

const escapeHtml = (s) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function render(f) {
  const rows = [
    ['Inquiry type', f.type],
    ['Name', f.name],
    ['Company', f.company || '—'],
    ['Email', f.email],
    ['Country', f.country || '—'],
  ];

  const text =
    rows.map(([k, v]) => `${k}: ${v}`).join('\n') +
    `\n\n---\n\n${f.message}\n\n---\nSent from the inquiry form at ecombrands.us\n`;

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#F3F1EB;font-family:ui-sans-serif,-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#121214">
  <div style="max-width:620px;margin:0 auto;background:#FFFFFF;border:1px solid #E2DFD8">
    <div style="padding:18px 24px;border-bottom:1px solid #E2DFD8">
      <div style="font:500 11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em;text-transform:uppercase;color:#D63200">New inquiry</div>
      <div style="font:500 11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:#7A7770;margin-top:4px">ecombrands.us</div>
    </div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">
      ${rows.map(([k, v]) => `<tr>
        <td style="padding:12px 24px;border-bottom:1px solid #EFEDE8;font:500 10px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:#8A8780;white-space:nowrap;vertical-align:top;width:150px">${escapeHtml(k)}</td>
        <td style="padding:12px 24px;border-bottom:1px solid #EFEDE8;font-size:15px;color:#121214">${escapeHtml(v)}</td>
      </tr>`).join('')}
    </table>
    <div style="padding:20px 24px;font-size:15px;line-height:1.6;white-space:pre-wrap">${escapeHtml(f.message)}</div>
    <div style="padding:14px 24px;border-top:1px solid #E2DFD8;font:500 10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;text-transform:uppercase;color:#8A8780">
      Reply directly to this email to answer ${escapeHtml(f.name)}
    </div>
  </div>
</body></html>`;

  return { text, html };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set');
    return res.status(500).json({ error: 'The form is not configured yet. Please email us directly.' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'Too many submissions. Please try again in a minute.' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  // honeypot: real people never fill a field they cannot see
  if (clean(body.website, 200)) return res.status(200).json({ ok: true });

  const f = {
    type: clean(body.type, 60) || 'Other',
    name: clean(body.name, 120),
    company: clean(body.company, 160),
    email: clean(body.email, 160),
    country: clean(body.country, 80),
    message: clean(body.message, 5000),
  };

  if (!f.name || !f.email || !f.message) {
    return res.status(400).json({ error: 'Name, email and message are required.' });
  }
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(f.email)) {
    return res.status(400).json({ error: 'That email address does not look right.' });
  }

  const { text, html } = render(f);

  // Comma-separated, blanks dropped. Unset or empty → the key is omitted below.
  const bcc = (process.env.INQUIRY_BCC || '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);

  try {
    const r = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.INQUIRY_FROM || 'Ecombrands <noreply@send.ecombrands.us>',
        to: [process.env.INQUIRY_TO || 'hello@ecombrands.us'],
        ...(bcc.length ? { bcc } : {}),
        reply_to: f.email,
        subject: `[${f.type}] ${f.company || f.name}`,
        text,
        html,
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error('Resend rejected the send:', r.status, detail);
      return res.status(502).json({ error: 'We could not send that right now. Please email hello@ecombrands.us directly.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Inquiry send failed:', err);
    return res.status(502).json({ error: 'We could not send that right now. Please email hello@ecombrands.us directly.' });
  }
};
