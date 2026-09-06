// /api/contact.js
// Vercel Serverless Function — receives contact form submissions and sends
// email notifications directly via Resend (https://resend.com), with no
// third-party form service (e.g. Formspree) involved.
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
    const name = (body.name || '').toString().trim();
    const email = (body.email || '').toString().trim();
    const company = (body.company || '').toString().trim();
    const phone = (body.phone || '').toString().trim();
    const service = (body.service || '').toString().trim();
    const budget = (body.budget || '').toString().trim();
    const message = (body.message || '').toString().trim();

    if (!name || !email) {
      res.status(400).json({ error: 'Name and email are required.' });
      return;
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('RESEND_API_KEY is not set in environment variables');
      res.status(500).json({ error: 'Server email configuration missing.' });
      return;
    }

    const html = `
      <h2>New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Company / Agency:</strong> ${escapeHtml(company || 'Not provided')}</p>
      <p><strong>Phone / WhatsApp:</strong> ${escapeHtml(phone || 'Not provided')}</p>
      <p><strong>Service Interested In:</strong> ${escapeHtml(service || 'Not specified')}</p>
      <p><strong>Monthly Budget:</strong> ${escapeHtml(budget || 'Not specified')}</p>
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(message || 'Not provided').replace(/\n/g, '<br>')}</p>
    `;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Apex Digital Forge <onboarding@resend.dev>',
        to: ['apexdigitalforge@gmail.com'],
        reply_to: email,
        subject: `New Contact Lead — ${name}`,
        html
      })
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('Resend API error:', resendRes.status, errText);
      res.status(502).json({ error: 'Failed to send email.' });
      return;
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Contact form handler error:', err);
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
