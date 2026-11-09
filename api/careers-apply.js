// /api/careers-apply.js
// Vercel Serverless Function — receives job/internship applications from /careers
// and emails them via Resend (same setup as /api/contact).
// Requires RESEND_API_KEY in the Vercel project environment variables.

const ROLES = ['International Closer', 'Lead Generation Intern'];
const MAX_RESUME_BYTES = 3 * 1024 * 1024; // 3 MB (Vercel request bodies are capped at ~4.5 MB incl. base64 overhead)

// Check the file really is a PDF / DOC / DOCX by its leading bytes, not just its name
function resumeKind(buf) {
  if (buf.length > 4 && buf.slice(0, 4).toString('latin1') === '%PDF') return 'pdf';
  if (buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return 'docx';
  if (buf.length > 8 && buf.slice(0, 8).toString('hex') === 'd0cf11e0a1b11ae1') return 'doc';
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = req.body || {};
    // Honeypot: real people never fill this hidden field
    if ((body.website || '').toString().trim()) {
      res.status(200).json({ success: true });
      return;
    }

    const clip = (v, n) => (v || '').toString().trim().slice(0, n);
    const name = clip(body.name, 120);
    const email = clip(body.email, 200);
    const phone = clip(body.phone, 60);
    const role = clip(body.role, 80);
    const experience = clip(body.experience, 80);
    const link = clip(body.link, 300);
    const message = clip(body.message, 3000);

    if (!name || !email || !role) {
      res.status(400).json({ error: 'Name, email and role are required.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (!ROLES.includes(role)) {
      res.status(400).json({ error: 'Unknown role.' });
      return;
    }

    // Optional resume attachment
    let attachments;
    let resumeNote = 'Not attached';
    const resume = body.resume;
    if (resume && resume.data) {
      const origName = clip(resume.name, 150);
      const ext = (origName.match(/\.(pdf|doc|docx)$/i) || [])[1];
      if (!ext) {
        res.status(400).json({ error: 'Resume must be a PDF, DOC or DOCX file.' });
        return;
      }
      const b64 = String(resume.data);
      if (!/^[A-Za-z0-9+/=\s]+$/.test(b64)) {
        res.status(400).json({ error: 'Invalid resume file.' });
        return;
      }
      const buf = Buffer.from(b64, 'base64');
      if (buf.length === 0 || buf.length > MAX_RESUME_BYTES) {
        res.status(400).json({ error: 'Resume must be under 3 MB.' });
        return;
      }
      if (!resumeKind(buf)) {
        res.status(400).json({ error: 'Resume must be a valid PDF, DOC or DOCX file.' });
        return;
      }
      const safeBase = origName.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9 _.-]/g, '').trim().slice(0, 60) || 'resume';
      const filename = `${safeBase}.${ext.toLowerCase()}`;
      attachments = [{ filename, content: buf.toString('base64') }];
      resumeNote = `Attached (${filename}, ${(buf.length / 1024).toFixed(0)} KB)`;
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('RESEND_API_KEY is not set in environment variables');
      res.status(500).json({ error: 'Server email configuration missing.' });
      return;
    }

    const html = `
      <h2>New Application — ${escapeHtml(role)}</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Phone / WhatsApp:</strong> ${escapeHtml(phone || 'Not provided')}</p>
      <p><strong>Role:</strong> ${escapeHtml(role)}</p>
      <p><strong>Experience:</strong> ${escapeHtml(experience || 'Not provided')}</p>
      <p><strong>LinkedIn / Portfolio:</strong> ${escapeHtml(link || 'Not provided')}</p>
      <p><strong>Resume:</strong> ${escapeHtml(resumeNote)}</p>
      <p><strong>Why they'd be a good fit:</strong></p>
      <p>${escapeHtml(message || 'Not provided').replace(/\n/g, '<br>')}</p>
    `;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Apex Digital Forge <noreply@apexdigitalforge.in>',
        to: ['apexdigitalforge@gmail.com'],
        reply_to: email,
        subject: `New Application — ${role} — ${name}`,
        html,
        ...(attachments ? { attachments } : {})
      })
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('Resend API error:', resendRes.status, errText);
      res.status(502).json({ error: 'Failed to send application.' });
      return;
    }

    // Best-effort confirmation to the applicant - never blocks the main response
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Apex Digital Forge <noreply@apexdigitalforge.in>',
          to: [email],
          subject: `We've received your application, ${name}`,
          html: `
            <h2>Thanks for applying, ${escapeHtml(name)}!</h2>
            <p>We've received your application for <strong>${escapeHtml(role)}</strong> at Apex Digital Forge. Our team will review it and contact you if there's a fit.</p>
            <p>This is an automated message. If you'd like to add anything, email us at apexdigitalforge@gmail.com.</p>
            <p>— The Apex Digital Forge Team</p>
          `
        })
      });
    } catch (replyErr) {
      console.error('Applicant auto-reply failed (non-blocking):', replyErr);
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Careers application handler error:', err);
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
