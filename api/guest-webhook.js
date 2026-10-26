// /api/guest-webhook.js?p=stripe | ?p=razorpay
// Payment confirmation. We never trust the webhook body: the payment is looked up
// again from the provider's API with our secret key, and only a "paid" status counts.
//   Stripe   : add endpoint https://www.apexdigitalforge.in/api/guest-webhook?p=stripe  (event: checkout.session.completed)
//   Razorpay : add webhook   https://www.apexdigitalforge.in/api/guest-webhook?p=razorpay (event: payment_link.paid)

const L = require('./_guest-lib');

module.exports = async function handler(req, res) {
  try {
    const p = String((req.query && req.query.p) || '');
    const body = req.body || {};
    let meta = null, paidAmount = '';
    if (p === 'stripe' && body.type === 'checkout.session.completed' && process.env.STRIPE_SECRET_KEY) {
      const id = body.data && body.data.object && body.data.object.id;
      const r = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } });
      const s = await r.json();
      if (r.ok && s.payment_status === 'paid') { meta = s.metadata || {}; paidAmount = `${(s.amount_total / 100).toFixed(2)} ${String(s.currency).toUpperCase()}`; }
    } else if (p === 'razorpay' && body.event === 'payment_link.paid' && process.env.RAZORPAY_KEY_ID) {
      const id = body.payload && body.payload.payment_link && body.payload.payment_link.entity && body.payload.payment_link.entity.id;
      const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
      const r = await fetch(`https://api.razorpay.com/v1/payment_links/${encodeURIComponent(id)}`, { headers: { Authorization: `Basic ${auth}` } });
      const s = await r.json();
      if (r.ok && s.status === 'paid') { meta = s.notes || {}; paidAmount = `${(s.amount_paid / 100).toFixed(2)} ${s.currency}`; }
    }
    if (meta) {
      const info = `<p><strong>Order:</strong> ${L.escapeHtml(meta.orderId)}<br><strong>Amount paid:</strong> ${L.escapeHtml(paidAmount)}<br><strong>Customer:</strong> ${L.escapeHtml(meta.name)} (${L.escapeHtml(meta.email)}) ${L.escapeHtml(meta.phone || '')}<br><strong>Content:</strong> ${meta.content === 'customer' ? 'Customer provides the content (20% discount applied)' : 'Written by Apex Digital Forge'}<br><strong>Sites:</strong> ${L.escapeHtml(meta.items)}</p>`;
      await L.sendMail({ to: L.OWNER_EMAIL, replyTo: meta.email, subject: `PAID: guest post order ${meta.orderId} — ${paidAmount}`, html: `<h2>Payment received</h2>${info}<p>The full cart was in the "Checkout started" email for this order.</p>` });
      if (meta.email) await L.sendMail({ to: meta.email, subject: `Payment received: guest post order ${meta.orderId}`, html: `<h2>Thank you, ${L.escapeHtml(meta.name)}!</h2><p>We received your payment of ${L.escapeHtml(paidAmount)} for order <strong>${L.escapeHtml(meta.orderId)}</strong>. We will start on your guest posts and keep you updated by email.</p><p>— The Apex Digital Forge Team</p>` });
    }
    res.status(200).json({ received: true });
  } catch (e) {
    console.error('guest-webhook error:', e);
    res.status(200).json({ received: true });
  }
};
