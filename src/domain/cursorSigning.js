'use strict';

const crypto = require('crypto');

function encodeBase64Url(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function computeSignature(raw, secret) {
  return crypto.createHmac('sha256', secret).update(raw).digest('base64url');
}

function timingSafeEqual(left, right) {
  const leftBuf = Buffer.from(left, 'utf8');
  const rightBuf = Buffer.from(right, 'utf8');
  if (leftBuf.length !== rightBuf.length) return false;
  return crypto.timingSafeEqual(leftBuf, rightBuf);
}

function signCursor(raw, secret, allowUnsigned) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw !== 'string') throw new Error('invalid cursor');
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const key = typeof secret === 'string' && secret.trim().length > 0 ? secret : null;
  if (!key) {
    if (!allowUnsigned) throw new Error('cursor secret required');
    return null;
  }
  const sig = computeSignature(trimmed, key);
  return encodeBase64Url(`${trimmed}.${sig}`);
}

function verifyCursor(signed, secret, allowUnsigned) {
  if (!signed) throw new Error('invalid cursor');
  if (typeof signed !== 'string') throw new Error('invalid cursor');
  const key = typeof secret === 'string' && secret.trim().length > 0 ? secret : null;
  if (!key && !allowUnsigned) throw new Error('cursor secret required');
  let decoded;
  try {
    decoded = decodeBase64Url(signed.trim());
  } catch (_err) {
    throw new Error('invalid cursor');
  }
  const lastDot = decoded.lastIndexOf('.');
  if (lastDot <= 0) throw new Error('invalid cursor');
  const raw = decoded.slice(0, lastDot);
  const sig = decoded.slice(lastDot + 1);
  if (!raw || !sig) throw new Error('invalid cursor');
  if (!/^[A-Za-z0-9_-]+$/.test(sig)) throw new Error('invalid cursor');
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error('invalid cursor');
  if (key) {
    const expected = computeSignature(raw, key);
    if (!timingSafeEqual(expected, sig)) throw new Error('invalid cursor');
  }
  return raw;
}

module.exports = {
  encodeBase64Url,
  signCursor,
  verifyCursor
};
