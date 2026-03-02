'use strict';

const crypto = require('crypto');

const DEFAULT_TTL_SECONDS = 5 * 60;

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizePathname(pathname) {
  const raw = normalizeText(pathname);
  if (!raw) return '/';
  if (raw === '/') return '/';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function resolveSigningSecret(secret) {
  const explicit = normalizeText(secret);
  if (explicit) return explicit;
  const env = normalizeText(process.env.TASK_API_SIGNING_SECRET);
  if (env) return env;
  if (process.env.NODE_ENV === 'test' || process.env.ENV_NAME === 'local') return 'local-task-api-signature-secret';
  return '';
}

function resolveTtlSeconds(ttlSeconds) {
  const explicit = Number(ttlSeconds);
  if (Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);
  const env = Number(process.env.TASK_API_SIGNATURE_TTL_SECONDS);
  if (Number.isFinite(env) && env > 0) return Math.floor(env);
  return DEFAULT_TTL_SECONDS;
}

function resolveNowMillis(now) {
  if (Number.isFinite(Number(now))) return Number(now);
  return Date.now();
}

function buildSignaturePayload(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const method = normalizeText(payload.method).toUpperCase() || 'GET';
  const pathname = normalizePathname(payload.pathname || '/');
  const userId = normalizeText(payload.userId);
  const ts = String(payload.ts === undefined || payload.ts === null ? '' : payload.ts).trim();
  const taskId = normalizeText(payload.taskId || '');
  return [method, pathname, userId, ts, taskId].join('|');
}

function signTaskApiRequest(input, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const secret = resolveSigningSecret(opts.secret);
  if (!secret) throw new Error('task api signing secret required');
  const payload = buildSignaturePayload(input);
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('base64url');
}

function safeEqual(left, right) {
  const leftBuf = Buffer.from(String(left || ''), 'utf8');
  const rightBuf = Buffer.from(String(right || ''), 'utf8');
  if (leftBuf.length !== rightBuf.length) return false;
  return crypto.timingSafeEqual(leftBuf, rightBuf);
}

function verifyTaskApiRequestSignature(input, options) {
  const payload = input && typeof input === 'object' ? input : {};
  const opts = options && typeof options === 'object' ? options : {};

  const userId = normalizeText(payload.userId);
  const tsRaw = String(payload.ts === undefined || payload.ts === null ? '' : payload.ts).trim();
  const sig = normalizeText(payload.sig);
  if (!userId || !tsRaw || !sig) return { ok: false, reason: 'missing_auth' };

  const ts = Number(tsRaw);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'invalid_ts' };

  const nowMs = resolveNowMillis(opts.now);
  const ttlMs = resolveTtlSeconds(opts.ttlSeconds) * 1000;
  if (Math.abs(nowMs - ts) > ttlMs) return { ok: false, reason: 'expired' };

  const secret = resolveSigningSecret(opts.secret);
  if (!secret) return { ok: false, reason: 'secret_missing' };

  const expectedSig = signTaskApiRequest({
    method: payload.method,
    pathname: payload.pathname,
    userId,
    ts: tsRaw,
    taskId: payload.taskId
  }, { secret });

  if (!safeEqual(expectedSig, sig)) return { ok: false, reason: 'signature_mismatch' };

  return {
    ok: true,
    userId,
    ts
  };
}

module.exports = {
  buildSignaturePayload,
  signTaskApiRequest,
  verifyTaskApiRequestSignature,
  resolveTtlSeconds,
  resolveSigningSecret
};
