// Shared helpers for the private offer-letter signing flow.
// Letters are NOT stored in the repo. They live in the OFFER_LETTERS environment
// variable (JSON map of unguessable token -> letter) in the Vercel project settings.

const crypto = require('crypto');

function loadLetters() {
  try {
    return JSON.parse(process.env.OFFER_LETTERS || '{}');
  } catch (e) {
    console.error('OFFER_LETTERS is not valid JSON');
    return {};
  }
}

// Returns the letter for a token, or null if the token is unknown or expired.
function findLetter(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{20,128}$/.test(token)) return null;
  const letters = loadLetters();
  if (!Object.prototype.hasOwnProperty.call(letters, token)) return null;
  const letter = letters[token];
  if (!letter || typeof letter.html !== 'string') return null;
  if (letter.expires && Date.now() > Date.parse(letter.expires)) return null;
  return letter;
}

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

module.exports = { findLetter, sha256, escapeHtml };
