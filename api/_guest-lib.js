// Shared helpers for the guest post checkout (not exposed as a route: file starts with "_").
const catalog = require('../data/guest-sites.json');
// PRIVATE: which partner network supplies each site (never sent to browsers or customers).
const partners = (require('./_partners.json').sites) || {};

const SITE_URL = process.env.SITE_URL || 'https://www.apexdigitalforge.in';
const OWNER_EMAIL = 'apexdigitalforge@gmail.com';

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function pickCurrency(country) {
  const allHaveINR = catalog.sites.length > 0 && catalog.sites.every(s => Number(s.priceINR) > 0);
  return country === 'IN' && allHaveINR ? 'INR' : 'USD';
}

function fmt(minor, cur) {
  const v = (minor / 100).toFixed(2);
  return (cur === 'INR' ? '₹' : '$') + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Prices always come from the server-side catalog, never from the browser.
function buildOrder(rawItems, contentProvided, country) {
  const currency = pickCurrency(country);
  const rate = Number(catalog.discountContentProvided) || 0.2;
  const lines = [];
  const seen = new Set();
  for (const it of Array.isArray(rawItems) ? rawItems.slice(0, 40) : []) {
    const site = catalog.sites.find(s => s.id === String(it && it.id));
    const qty = Math.floor(Number(it && it.qty));
    if (!site || seen.has(site.id) || !(qty >= 1 && qty <= 20)) continue;
    seen.add(site.id);
    const unit = Math.round(Number(currency === 'INR' ? site.priceINR : site.priceUSD) * 100);
    if (!(unit > 0)) continue;
    const unitPaid = contentProvided ? Math.round(unit * (1 - rate)) : unit;
    const pr = partners[site.id] || {};
    lines.push({ id: site.id, name: site.name, da: site.da, pa: site.pa, link: site.link, niche: (site.niches || [site.niche]).filter(Boolean).join(', '), partner: pr.partner, partnerPrice: pr.partnerPrice, qty, unit, unitPaid, subtotal: unit * qty, total: unitPaid * qty });
  }
  const subtotal = lines.reduce((a, l) => a + l.subtotal, 0);
  const total = lines.reduce((a, l) => a + l.total, 0);
  return { currency, lines, subtotal, discount: subtotal - total, total, contentProvided: !!contentProvided, rate };
}

function orderId() {
  return 'GP-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

const LINK = { dofollow: 'Dofollow', nofollow: 'Nofollow', mixed: 'Dofollow/nofollow mix' };

// forOwner=true adds the internal partner number. Customer emails never include it.
function linesTable(order, forOwner) {
  const rows = order.lines.map(l => `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(l.name)}<br><small style="color:#666;">DA ${escapeHtml(l.da)} · PA ${escapeHtml(l.pa)} · ${escapeHtml(LINK[l.link] || l.link)} · ${escapeHtml(l.niche)}</small>${forOwner ? `<br><small style="color:#b45309;">Partner ${escapeHtml(l.partner || 'unknown')}${l.partnerPrice ? ` · partner sheet price ${l.partnerPrice} USD each` : ''}</small>` : ''}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;">${l.qty}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${fmt(l.unitPaid, order.currency)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${fmt(l.total, order.currency)}</td></tr>`).join('');
  return `<table style="border-collapse:collapse;width:100%;font-size:14px;"><thead><tr><th style="text-align:left;padding:6px 10px;">Website</th><th style="padding:6px 10px;">Qty</th><th style="text-align:right;padding:6px 10px;">Each</th><th style="text-align:right;padding:6px 10px;">Total</th></tr></thead><tbody>${rows}</tbody></table>
  <p style="font-size:14px;">Subtotal: ${fmt(order.subtotal, order.currency)}${order.discount ? `<br>Content provided by customer (−${Math.round(order.rate * 100)}%): −${fmt(order.discount, order.currency)}` : ''}<br><strong>Total: ${fmt(order.total, order.currency)}</strong></p>`;
}

function customerBlock(c) {
  return `<p style="font-size:14px;"><strong>Name:</strong> ${escapeHtml(c.name)}<br><strong>Email:</strong> ${escapeHtml(c.email)}<br><strong>WhatsApp / phone:</strong> ${escapeHtml(c.phone || 'Not provided')}<br><strong>Content:</strong> ${c.contentProvided ? 'Customer will provide the content (20% discount applied)' : 'Written by Apex Digital Forge'}<br><strong>Target URL(s), anchors, notes:</strong><br>${escapeHtml(c.notes || 'Not provided').replace(/\n/g, '<br>')}</p>`;
}

async function sendMail({ to, subject, html, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.error('RESEND_API_KEY is not set'); return false; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Apex Digital Forge <noreply@apexdigitalforge.in>', to: Array.isArray(to) ? to : [to], reply_to: replyTo, subject, html })
  });
  if (!r.ok) console.error('Resend error', r.status, await r.text());
  return r.ok;
}

module.exports = { catalog, SITE_URL, OWNER_EMAIL, escapeHtml, buildOrder, orderId, fmt, linesTable, customerBlock, sendMail };
