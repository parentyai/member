'use strict';

const crypto = require('crypto');

const VERSION = 1;
const PREFIX = `t${VERSION}`;

function base64urlEncode(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64urlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function timingSafeEqual(left, right) {
  const leftBuf = Buffer.from(left, 'utf8');
  const rightBuf = Buffer.from(right, 'utf8');
  if (leftBuf.length !== rightBuf.length) return false;
  return crypto.timingSafeEqual(leftBuf, rightBuf);
}

function resolveNowSec(nowSec) {
  if (typeof nowSec === 'number' && Number.isFinite(nowSec)) return Math.floor(nowSec);
  return Math.floor(Date.now() / 1000);
}

function resolveSecret(value) {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return null;
}

function computeSignature(payloadB64, secret) {
  return crypto.createHmac('sha256', secret).update(`${PREFIX}.${payloadB64}`).digest('base64url');
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} required`);
  }
  return value.trim();
}

function ensurePayloadShape(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('invalid token');
  requireNonEmptyString(payload.deliveryId, 'deliveryId');
  requireNonEmptyString(payload.linkRegistryId, 'linkRegistryId');
  if (!Number.isFinite(payload.iat)) throw new Error('invalid token');
  if (!Number.isFinite(payload.exp)) throw new Error('invalid token');
  return payload;
}

function createTrackToken(params, options) {
  const payload = params || {};
  const opts = options || {};
  const secret = resolveSecret(opts.secret || process.env.TRACK_TOKEN_SECRET);
  if (!secret) throw new Error('track token secret required');

  const nowSec = resolveNowSec(opts.nowSec);
  const ttlSec = typeof opts.ttlSec === 'number' && Number.isFinite(opts.ttlSec)
    ? Math.floor(opts.ttlSec)
    : 7 * 24 * 60 * 60;
  const record = ensurePayloadShape({
    deliveryId: payload.deliveryId,
    linkRegistryId: payload.linkRegistryId,
    iat: nowSec,
    exp: nowSec + ttlSec
  });

  const json = JSON.stringify(record);
  const payloadB64 = base64urlEncode(json);
  const sig = computeSignature(payloadB64, secret);
  return `${PREFIX}.${payloadB64}.${sig}`;
}

function decodeTrackToken(token, options) {
  if (!token || typeof token !== 'string') throw new Error('invalid token');
  const trimmed = token.trim();
  if (!trimmed.startsWith(`${PREFIX}.`)) throw new Error('invalid token');

  const parts = trimmed.split('.');
  if (parts.length !== 3) throw new Error('invalid token');

  const payloadB64 = parts[1];
  const sig = parts[2];

  const opts = options || {};
  const secret = resolveSecret(opts.secret || process.env.TRACK_TOKEN_SECRET);
  if (!secret) throw new Error('track token secret required');

  const expected = computeSignature(payloadB64, secret);
  if (!timingSafeEqual(expected, sig)) throw new Error('invalid token');

  let payload;
  try {
    payload = JSON.parse(base64urlDecode(payloadB64));
  } catch (_err) {
    throw new Error('invalid token');
  }

  const record = ensurePayloadShape(payload);
  const nowSec = resolveNowSec(opts.nowSec);
  if (nowSec > record.exp) throw new Error('token expired');

  const maxFutureSkewSec = typeof opts.maxFutureSkewSec === 'number' && Number.isFinite(opts.maxFutureSkewSec)
    ? Math.floor(opts.maxFutureSkewSec)
    : 60;
  if (record.iat > nowSec + maxFutureSkewSec) throw new Error('invalid token');
  if (record.exp < record.iat) throw new Error('invalid token');

  return record;
}

module.exports = {
  createTrackToken,
  decodeTrackToken
};
