'use strict';

const crypto = require('crypto');

// Normalize user-provided membership id into a strict "NN-NNNN" format.
// - Accepts full-width digits and common hyphen variants.
// - Removes whitespace.
// - Returns null when invalid.
function normalizeRidacMembershipId(input) {
  const raw = typeof input === 'string' ? input : '';
  let s = raw.trim();
  if (!s) return null;

  // Full-width digits -> ASCII digits.
  s = s.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 0x30));

  // Normalize hyphens.
  s = s.replace(/[‐‑‒–—―−ーｰ]/g, '-');

  // Remove all whitespace.
  s = s.replace(/\s+/g, '');

  const m = s.match(/^(\d{2})-(\d{4})$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}`;
}

function extractLast4(normalizedRidacMembershipId) {
  const s = typeof normalizedRidacMembershipId === 'string' ? normalizedRidacMembershipId : '';
  const digits = s.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

function computeRidacMembershipIdHash(normalizedRidacMembershipId, secret) {
  const id = typeof normalizedRidacMembershipId === 'string' ? normalizedRidacMembershipId : '';
  const sec = typeof secret === 'string' ? secret.trim() : '';
  if (!id) throw new Error('normalized ridacMembershipId required');
  if (!sec) throw new Error('RIDAC_MEMBERSHIP_ID_HMAC_SECRET required');
  // hex is safe as a Firestore document id.
  return crypto.createHmac('sha256', sec).update(id, 'utf8').digest('hex');
}

module.exports = {
  normalizeRidacMembershipId,
  extractLast4,
  computeRidacMembershipIdHash
};

