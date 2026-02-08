'use strict';

const crypto = require('crypto');

const BUCKET_MS = 10 * 60 * 1000;

function resolveBucket(now) {
  const time = now instanceof Date ? now.getTime() : Date.now();
  return Math.floor(time / BUCKET_MS);
}

function normalizeValue(value) {
  if (value === undefined || value === null) return '';
  return String(value);
}

function buildPayload(data, bucket) {
  const payload = data || {};
  return [
    normalizeValue(payload.planHash),
    normalizeValue(payload.templateKey),
    normalizeValue(payload.templateVersion),
    normalizeValue(payload.segmentKey),
    String(bucket)
  ].join('|');
}

function encodeBase64Url(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function computeSignature(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function timingSafeEqual(left, right) {
  const leftBuf = Buffer.from(left, 'utf8');
  const rightBuf = Buffer.from(right, 'utf8');
  if (leftBuf.length !== rightBuf.length) return false;
  return crypto.timingSafeEqual(leftBuf, rightBuf);
}

function resolveSecret(secret) {
  if (typeof secret === 'string' && secret.trim().length > 0) return secret.trim();
  const envName = process.env.ENV_NAME || 'local';
  if (envName === 'local' || process.env.NODE_ENV === 'test') return 'local-confirm-secret';
  return null;
}

function createConfirmToken(data, options) {
  const opts = options || {};
  const secret = resolveSecret(opts.secret || process.env.OPS_CONFIRM_TOKEN_SECRET);
  if (!secret) throw new Error('confirm token secret required');
  const bucket = resolveBucket(opts.now);
  const payload = buildPayload(data, bucket);
  const sig = computeSignature(payload, secret);
  return encodeBase64Url(`${payload}.${sig}`);
}

function verifyConfirmToken(token, data, options) {
  if (!token || typeof token !== 'string') return false;
  const opts = options || {};
  const secret = resolveSecret(opts.secret || process.env.OPS_CONFIRM_TOKEN_SECRET);
  if (!secret) return false;
  let decoded;
  try {
    decoded = decodeBase64Url(token.trim());
  } catch (_err) {
    return false;
  }
  const lastDot = decoded.lastIndexOf('.');
  if (lastDot <= 0) return false;
  const payload = decoded.slice(0, lastDot);
  const sig = decoded.slice(lastDot + 1);
  const expectedSig = computeSignature(payload, secret);
  if (!timingSafeEqual(expectedSig, sig)) return false;

  const parts = payload.split('|');
  if (parts.length !== 5) return false;
  const bucket = Number(parts[4]);
  if (!Number.isFinite(bucket)) return false;
  const nowBucket = resolveBucket(opts.now);
  if (bucket !== nowBucket) return false;

  const expectedPayload = buildPayload(data, bucket);
  return expectedPayload === payload;
}

module.exports = {
  createConfirmToken,
  verifyConfirmToken
};
