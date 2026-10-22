// /api/geo.js
// Vercel Serverless Function — returns the visitor's country code, which
// Vercel adds to every request as the x-vercel-ip-country header. Used by
// js/main.js to show INR pricing to visitors in India and USD pricing to
// everyone else. No IP address is read, logged or stored here.

module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ country: (req.headers['x-vercel-ip-country'] || '').toString().toUpperCase() });
};
