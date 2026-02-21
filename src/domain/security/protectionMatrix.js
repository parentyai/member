'use strict';

const PHASE_PREFIX_PROTECTED = Object.freeze([
  '/api/phase67/',
  '/api/phase68/',
  '/api/phase73/retry-queue',
  '/api/phase77/segments',
  '/api/phase81/segment-send',
  '/api/phase5/state/',
  '/api/phase1/events'
]);

function hasOpsLikeSegment(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.includes('admin')) return true;
  if (parts.includes('ops')) return true;
  return parts.some((part) => typeof part === 'string' && part.startsWith('ops-'));
}

function resolvePathProtection(pathname) {
  if (!pathname || typeof pathname !== 'string') return null;
  if (pathname.startsWith('/admin/')) return { auth: 'adminToken' };
  if (pathname.startsWith('/api/admin/')) return { auth: 'adminToken' };
  if (pathname.startsWith('/internal/')) return { auth: 'internalToken' };

  if (!pathname.startsWith('/api/phase')) return null;
  if (pathname.startsWith('/api/phaseLLM')) return { auth: 'adminToken' };
  if (PHASE_PREFIX_PROTECTED.some((prefix) => pathname.startsWith(prefix))) return { auth: 'adminToken' };
  if (hasOpsLikeSegment(pathname)) return { auth: 'adminToken' };
  return null;
}

function isProtectedOpsPath(pathname) {
  return Boolean(resolvePathProtection(pathname));
}

module.exports = {
  resolvePathProtection,
  isProtectedOpsPath
};
