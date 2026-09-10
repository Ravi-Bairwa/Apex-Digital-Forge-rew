// /api/quick-lead.js
// Vercel Serverless Function — receives the lightweight "Get It Now" widget
// submissions (just email + website URL) and emails them via Resend, same
// pattern as api/contact.js and api/seo-audit.js.
//
// Requires an environment variable set in the Vercel project:
//   RESEND_API_KEY = <your Resend API key>

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body || {};
    const email = (body.email || '').toString().trim();
    const website = (body.website || '').toString().trim();

    if (!email || !website) {
      res.status(400).json({ error: 'Email and website are required.' });
      return;
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('RESEND_API_KEY is not set in environment variables');
      res.status(500).json({ error: 'Server email configuration missing.' });
      return;
    }

    const html = `
      <h2>New Quick Lead — "Get It Now" widget</h2>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Website:</strong> ${escapeHtml(website)}</p>
      <p><strong>Page:</strong> ${escapeHtml((body.source_page || 'Not provided'))}</p>
    `;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Apex Digital Forge <noreply@apexdigitalforge.in>',
        to: ['apexdigitalforge@gmail.com'],
        reply_to: email,
        subject: `Quick Lead — ${website}`,
        html
      })
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('Resend API error:', resendRes.status, errText);
      res.status(502).json({ error: 'Failed to send email.' });
      return;
    }

    // Best-effort auto-reply to the client - never blocks the main response
    try {
      const replyHtml = `
        <h2>Thanks for reaching out!</h2>
        <p>We're taking a look at <strong>${escapeHtml(website)}</strong> now and will follow up with what we'd build within a few hours.</p>
        <p>This is an automated message — please don't reply to it. For anything else, email us directly at apexdigitalforge@gmail.com.</p>
        <p>— The Apex Digital Forge Team</p>
      `;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Apex Digital Forge <noreply@apexdigitalforge.in>',
          to: [email],
          subject: `Got it — we're taking a look at your site`,
          html: replyHtml
        })
      });
    } catch (replyErr) {
      console.error('Client auto-reply failed (non-blocking):', replyErr);
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Quick lead handler error:', err);
    res.status(500).json({ error: 'Unexpected server error.' });
  }
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
