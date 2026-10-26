// /api/guest-checkout.js
// Receives a guest post bucket from /guest-posts.
//  stage "checkout"  : customer pressed Checkout -> email the owner right away (so an unpaid order can be followed up),
//                      then create a payment session if a provider is configured, otherwise reply "received".
//  stage "abandoned" : customer filled in their email, had sites in the bucket and left -> email the owner only.
// Prices are always recalculated here from data/guest-sites.json.
//
// Optional environment variables (Vercel project settings):
//   RESEND_API_KEY                          (already used by the contact form)
//   STRIPE_SECRET_KEY                       -> Stripe Checkout
//   RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET   -> Razorpay Payment Links
//   SITE_URL                                -> defaults to https://www.apexdigitalforge.in

const L = require('./_guest-lib');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    const b = req.body || {};
    if (b.company_website) { res.status(200).json({ ok: true }); return; } // honeypot
    const stage = b.stage === 'abandoned' ? 'abandoned' : 'checkout';
    const country = String(req.headers['x-vercel-ip-country'] || '').toUpperCase();
    const c = {
      name: String(b.name || '').trim().slice(0, 120),
      email: String(b.email || '').trim().slice(0, 160),
      phone: String(b.phone || '').trim().slice(0, 40),
      notes: String(b.notes || '').trim().slice(0, 2000),
      contentProvided: !!b.contentProvided
    };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email) || (stage === 'checkout' && !c.name)) {
      res.status(400).json({ error: 'Please enter your name and a valid email.' }); return;
    }
    const order = L.buildOrder(b.items, c.contentProvided, country);
    if (!order.lines.length) { res.status(400).json({ error: 'Your bucket is empty or contains unavailable sites.' }); return; }
    const id = L.orderId();
    const where = country ? ` (visitor country: ${L.escapeHtml(country)})` : '';

    if (stage === 'abandoned') {
      await L.sendMail({
        to: L.OWNER_EMAIL, replyTo: c.email,
        subject: `Unpaid cart to follow up — ${c.name || c.email} — ${L.fmt(order.total, order.currency)}`,
        html: `<h2>Guest post bucket left without paying</h2><p>This visitor entered their email and left the page. Worth a follow-up.${where}</p>${L.customerBlock(c)}${L.linesTable(order)}`
      });
      res.status(200).json({ ok: true }); return;
    }

    // Tell the owner immediately, before any payment happens.
    await L.sendMail({
      to: L.OWNER_EMAIL, replyTo: c.email,
      subject: `Guest post order started (${id}) — ${c.name} — ${L.fmt(order.total, order.currency)}`,
      html: `<h2>Checkout started — payment not confirmed yet</h2><p>Order ${id}${where}. If you don't see a "PAID" email for this order, follow up with the customer.</p>${L.customerBlock(c)}${L.linesTable(order)}`
    });

    const meta = { orderId: id, name: c.name, email: c.email, phone: c.phone, content: c.contentProvided ? 'customer' : 'apex', total: L.fmt(order.total, order.currency), items: order.lines.map(l => `${l.name} x${l.qty}`).join(', ').slice(0, 450) };
    let payUrl = null;
    try {
      if (process.env.STRIPE_SECRET_KEY) payUrl = await stripeSession(order, c, meta);
      else if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) payUrl = await razorpayLink(order, c, meta);
    } catch (e) { console.error('Payment provider error:', e.message); }

    // Customer acknowledgement (best effort)
    await L.sendMail({
      to: c.email,
      subject: `We received your guest post order (${id})`,
      html: `<h2>Thanks, ${L.escapeHtml(c.name)}!</h2><p>We received your guest post order <strong>${id}</strong>.${payUrl ? ' Complete the payment on the secure page you were sent to and we will start right away.' : ' We will email you a secure payment link shortly.'}</p>${L.linesTable(order)}<p>Questions? Email apexdigitalforge@gmail.com.</p><p>— The Apex Digital Forge Team</p>`
    });

    res.status(200).json({ ok: true, orderId: id, payUrl, total: L.fmt(order.total, order.currency) });
  } catch (e) {
    console.error('guest-checkout error:', e);
    res.status(500).json({ error: 'Something went wrong. Please email apexdigitalforge@gmail.com.' });
  }
};

async function stripeSession(order, c, meta) {
  const p = new URLSearchParams();
  p.set('mode', 'payment');
  p.set('success_url', `${L.SITE_URL}/guest-posts?paid=1`);
  p.set('cancel_url', `${L.SITE_URL}/guest-posts`);
  p.set('customer_email', c.email);
  p.set('client_reference_id', meta.orderId);
  order.lines.forEach((l, i) => {
    p.set(`line_items[${i}][quantity]`, String(l.qty));
    p.set(`line_items[${i}][price_data][currency]`, order.currency.toLowerCase());
    p.set(`line_items[${i}][price_data][unit_amount]`, String(l.unitPaid));
    p.set(`line_items[${i}][price_data][product_data][name]`, `Guest post: ${l.name} (DA ${l.da})`);
  });
  Object.keys(meta).forEach(k => p.set(`metadata[${k}]`, String(meta[k])));
  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: p });
  const j = await r.json();
  if (!r.ok) throw new Error('Stripe: ' + (j.error && j.error.message));
  return j.url;
}

async function razorpayLink(order, c, meta) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const r = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST', headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: order.total, currency: order.currency, accept_partial: false, reference_id: meta.orderId,
      description: `Guest posts ${meta.orderId}`, customer: { name: c.name, email: c.email, contact: c.phone || undefined },
      notify: { email: true, sms: false }, reminder_enable: true, notes: meta,
      callback_url: `${L.SITE_URL}/guest-posts?paid=1`, callback_method: 'get'
    })
  });
  const j = await r.json();
  if (!r.ok) throw new Error('Razorpay: ' + (j.error && j.error.description));
  return j.short_url;
}
