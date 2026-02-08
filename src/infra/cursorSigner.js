'use strict';

const crypto = require('crypto');

const VERSION = 1;
const PREFIX = `v${VERSION}`;

function base64urlEncode(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64urlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function computeSignature(payloadB64, secret) {
  return crypto.createHmac('sha256', secret).update(`${PREFIX}.${payloadB64}`).digest('base64url');
}

function timingSafeEqual(left, right) {
  const leftBuf = Buffer.from(left, 'utf8');
  const rightBuf = Buffer.from(right, 'utf8');
  if (leftBuf.length !== rightBuf.length) return false;
  return crypto.timingSafeEqual(leftBuf, rightBuf);
}

function ensurePayloadShape(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('invalid cursor');
  if (payload.v !== VERSION) throw new Error('invalid cursor');
  if (!payload.lastSortKey || typeof payload.lastSortKey !== 'object') throw new Error('invalid cursor');
  const key = payload.lastSortKey;
  if (!Number.isFinite(key.readinessRank)) throw new Error('invalid cursor');
  if (typeof key.lineUserId !== 'string' || key.lineUserId.trim().length === 0) throw new Error('invalid cursor');
  if (key.cursorCandidate !== null && key.cursorCandidate !== undefined) {
    if (typeof key.cursorCandidate !== 'string') throw new Error('invalid cursor');
    const date = new Date(key.cursorCandidate);
    if (Number.isNaN(date.getTime())) throw new Error('invalid cursor');
  }
  if (!Number.isFinite(payload.issuedAt)) throw new Error('invalid cursor');
  return payload;
}

function encodeCursor(input, options) {
  if (!input) return null;
  const opts = options || {};
  const secret = typeof opts.secret === 'string' && opts.secret.trim().length > 0 ? opts.secret : null;
  const allowUnsigned = Boolean(opts.allowUnsigned);
  const issuedAt = Number.isFinite(input.issuedAt) ? input.issuedAt : Date.now();
  const lastSortKey = input.lastSortKey || {};
  const payload = {
    v: VERSION,
    lastSortKey: {
      readinessRank: lastSortKey.readinessRank,
      cursorCandidate: lastSortKey.cursorCandidate === undefined ? null : lastSortKey.cursorCandidate,
      lineUserId: lastSortKey.lineUserId
    },
    issuedAt
  };
  const json = JSON.stringify(payload);
  const payloadB64 = base64urlEncode(json);
  if (!secret) {
    if (!allowUnsigned) throw new Error('cursor secret required');
    return `${PREFIX}.${payloadB64}`;
  }
  const sig = computeSignature(payloadB64, secret);
  return `${PREFIX}.${payloadB64}.${sig}`;
}

function decodeCursor(value, options) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error('invalid cursor');
  const token = value.trim();
  if (!token.startsWith(`${PREFIX}.`)) throw new Error('invalid cursor');
  const parts = token.split('.');
  if (parts.length !== 2 && parts.length !== 3) throw new Error('invalid cursor');
  const payloadB64 = parts[1];
  const signature = parts.length === 3 ? parts[2] : null;

  const opts = options || {};
  const secret = typeof opts.secret === 'string' && opts.secret.trim().length > 0 ? opts.secret : null;
  const enforce = Boolean(opts.enforce);
  const allowUnsigned = Boolean(opts.allowUnsigned);

  if (secret) {
    if (!signature) {
      if (enforce) throw new Error('invalid cursor');
    } else {
      const expected = computeSignature(payloadB64, secret);
      if (!timingSafeEqual(expected, signature)) throw new Error('invalid cursor');
    }
  } else if (!allowUnsigned) {
    throw new Error('cursor secret required');
  }

  let payload;
  try {
    payload = JSON.parse(base64urlDecode(payloadB64));
  } catch (err) {
    throw new Error('invalid cursor');
  }

  return ensurePayloadShape(payload);
}

module.exports = {
  encodeCursor,
  decodeCursor,
  computeSignature
};
