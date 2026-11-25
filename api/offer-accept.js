// POST /api/offer-accept
// Records the candidate's acceptance and on-screen signature by emailing a self-contained
// signed copy to the company and to the candidate (via Resend, same setup as /api/contact).
// Requires RESEND_API_KEY and OFFER_LETTERS in the Vercel environment variables.

const { findLetter, sha256, escapeHtml } = require('./_offers');

const COMPANY_EMAIL = 'apexdigitalforge@gmail.com';
const MAX_SIGNATURE_CHARS = 450000; // ~330 KB of base64

const normalise = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

function istStamp(date) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'long'
  }).format(date);
}

function signedCopyHtml({ letter, name, email, acceptedAt, ip, userAgent, docHash, signature }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Signed offer letter - ${escapeHtml(name)}</title>
<style>
body{font-family:Arial,Helvetica,sans-serif;color:#111827;max-width:780px;margin:32px auto;padding:0 24px;line-height:1.6;font-size:14px}
.head{display:flex;align-items:center;gap:16px;border-bottom:3px solid #16a34a;padding-bottom:14px;margin-bottom:24px}
.head img{height:64px}.head b{font-size:22px}
h3{font-size:15px;margin:22px 0 6px;color:#14532d}h3 span{color:#16a34a;margin-right:6px}
table{border-collapse:collapse;width:100%;margin:10px 0}th,td{border:1px solid #d1d5db;padding:8px 10px;text-align:left}th{background:#f0fdf4}
.record{margin-top:32px;border:2px solid #16a34a;border-radius:10px;padding:18px 20px;background:#f0fdf4}
.record h2{margin:0 0 10px;font-size:16px;color:#14532d}.record p{margin:4px 0}
.sig{background:#fff;border:1px solid #d1d5db;border-radius:6px;padding:8px;display:inline-block;margin-top:8px}
.sig img{max-width:320px;height:auto;display:block}.mono{font-family:monospace;font-size:12px;word-break:break-all}
.sigline{display:inline-block;width:220px;border-bottom:1px solid #111827;height:30px}
</style></head><body>
<div class="head"><img src="https://www.apexdigitalforge.in/assets/logo_apex.png" alt=""><div><b>Apex Digital Forge</b><br>apexdigitalforge.in &middot; ${COMPANY_EMAIL}</div></div>
${letter.html}
<div class="record">
<h2>Acceptance record (electronic)</h2>
<p><b>Accepted by:</b> ${escapeHtml(name)} (${escapeHtml(email)})</p>
<p><b>Declaration:</b> The candidate ticked the box confirming they have read and accept this offer letter and signed on screen.</p>
<p><b>Date and time:</b> ${escapeHtml(istStamp(acceptedAt))} (${acceptedAt.toISOString()})</p>
<p><b>IP address:</b> ${escapeHtml(ip)}</p>
<p><b>Browser:</b> ${escapeHtml(userAgent)}</p>
<p><b>Letter fingerprint (SHA-256):</b> <span class="mono">${docHash}</span></p>
<div class="sig"><img src="${signature}" alt="Signature of ${escapeHtml(name)}"></div>
</div>
</body></html>`;
}

async function sendMail(apiKey, payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) {
    console.error('Resend error:', r.status, await r.text());
    return false;
  }
  return true;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body || {};
    if ((body.website || '').toString().trim()) { // honeypot
      res.status(200).json({ success: true });
      return;
    }

    const letter = findLetter(body.t);
    if (!letter) {
      res.status(404).json({ error: 'This link is not valid or has expired.' });
      return;
    }

    const typedName = String(body.name || '').trim().slice(0, 120);
    let name = typedName;
    const email = String(body.email || '').trim().slice(0, 200);
    const signature = String(body.signature || '');

    if (body.accepted !== true) {
      res.status(400).json({ error: 'Please tick the box to accept the offer.' });
      return;
    }
    if (letter.candidateName && normalise(typedName) !== normalise(letter.candidateName)) {
      res.status(400).json({ error: `Please type your full name exactly as shown: ${letter.candidateName}` });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (letter.candidateName) name = letter.candidateName; // record the name exactly as written in the letter
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signature) ||
        signature.length < 1500 || signature.length > MAX_SIGNATURE_CHARS) {
      res.status(400).json({ error: 'Please sign in the box before submitting.' });
      return;
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('RESEND_API_KEY is not set');
      res.status(500).json({ error: 'Email service is not configured.' });
      return;
    }

    const acceptedAt = new Date();
    const ip = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim();
    const userAgent = String(req.headers['user-agent'] || 'unknown').slice(0, 300);
    const docHash = sha256(letter.html);

    const html = signedCopyHtml({ letter, name, email, acceptedAt, ip, userAgent, docHash, signature });
    const fileBase = `signed-offer-letter-${name.replace(/[^A-Za-z0-9]+/g, '-')}`;
    const attachments = [
      { filename: `${fileBase}.html`, content: Buffer.from(html, 'utf8').toString('base64') },
      { filename: 'signature.png', content: signature.split(',')[1] }
    ];

    const ok = await sendMail(apiKey, {
      from: 'Apex Digital Forge <noreply@apexdigitalforge.in>',
      to: [COMPANY_EMAIL],
      reply_to: email,
      subject: `Offer accepted - ${name} - ${letter.title || 'Offer Letter'}`,
      html: `<h2>Offer letter accepted</h2>
        <p><strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}) accepted <em>${escapeHtml(letter.title || 'the offer letter')}</em>.</p>
        <p><strong>Time:</strong> ${escapeHtml(istStamp(acceptedAt))}<br><strong>IP:</strong> ${escapeHtml(ip)}<br><strong>Letter fingerprint (SHA-256):</strong> ${docHash}</p>
        <p>The signed copy (open the .html file in a browser) and the signature image are attached. Keep them with the candidate's records.</p>`,
      attachments
    });
    if (!ok) {
      res.status(502).json({ error: 'Could not record your acceptance. Please try again or email apexdigitalforge@gmail.com.' });
      return;
    }

    // Best-effort copy for the candidate
    try {
      await sendMail(apiKey, {
        from: 'Apex Digital Forge <noreply@apexdigitalforge.in>',
        to: [email],
        subject: `Your signed offer letter - Apex Digital Forge`,
        html: `<h2>Thank you, ${escapeHtml(name)}</h2>
          <p>We have recorded your acceptance of the offer letter. A signed copy is attached (open the .html file in any browser). Please keep it for your records.</p>
          <p>- Apex Digital Forge</p>`,
        attachments: [attachments[0]]
      });
    } catch (e) {
      console.error('Candidate copy failed (non-blocking):', e);
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('offer-accept error:', err);
    res.status(500).json({ error: 'Unexpected server error.' });
  }
};
