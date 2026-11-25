// GET /api/offer?t=<token>  ->  { title, candidateName, html }
// Returns the private offer letter for a valid, unexpired token. Nothing else is exposed.

const { findLetter } = require('./_offers');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const letter = findLetter((req.query && req.query.t) || '');
  if (!letter) {
    // Same answer for unknown, malformed and expired links
    res.status(404).json({ error: 'This link is not valid or has expired.' });
    return;
  }

  res.status(200).json({
    title: letter.title || 'Offer Letter',
    candidateName: letter.candidateName || '',
    html: letter.html
  });
};
