// /api/seo-audit.js
// Vercel Serverless Function — receives Free SEO Audit request submissions and
// sends email notifications directly via Resend (https://resend.com), with no
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
    const websiteUrl = (body.website_url || '').toString().trim();
    const name = (body.name || '').toString().trim();
    const email = (body.email || '').toString().trim();
    const phone = (body.phone || '').toString().trim();
    const budget = (body.budget || '').toString().trim();
    const goal = (body.goal || '').toString().trim();

    if (!websiteUrl || !name || !email) {
      res.status(400).json({ error: 'Website URL, name, and email are required.' });
      return;
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('RESEND_API_KEY is not set in environment variables');
      res.status(500).json({ error: 'Server email configuration missing.' });
      return;
    }

    const html = `
      <h2>New Free SEO Audit Request</h2>
      <p><strong>Website URL:</strong> ${escapeHtml(websiteUrl)}</p>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone || 'Not provided')}</p>
      <p><strong>Monthly SEO Budget:</strong> ${escapeHtml(budget || 'Not specified')}</p>
      <p><strong>Main SEO Goal:</strong> ${escapeHtml(goal || 'Not specified')}</p>
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
        subject: `Free SEO Audit Request — ${websiteUrl}`,
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
    console.error('SEO audit handler error:', err);
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
