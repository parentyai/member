'use strict';

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { handleLineWebhook } = require('./routes/webhookLine');

const PORT = Number(process.env.PORT || 8080);
const ENV_NAME = process.env.ENV_NAME || 'local';
const MAX_BODY_BYTES = 1024 * 1024;

function getServiceMode() {
  return process.env.SERVICE_MODE || 'member';
}

function timingSafeEqualString(a, b) {
  const left = Buffer.from(String(a), 'utf8');
  const right = Buffer.from(String(b), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function resolveAdminOsToken() {
  const v = process.env.ADMIN_OS_TOKEN;
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function parseCookies(headerValue) {
  const out = {};
  if (typeof headerValue !== 'string' || headerValue.trim().length === 0) return out;
  const parts = headerValue.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = value;
  }
  return out;
}

function resolveAdminTokenFromRequest(req) {
  const headerToken = req && req.headers && req.headers['x-admin-token'];
  if (typeof headerToken === 'string' && headerToken.trim().length > 0) {
    return { token: headerToken.trim(), source: 'header' };
  }
  const cookieHeader = req && req.headers && req.headers.cookie;
  const cookies = parseCookies(typeof cookieHeader === 'string' ? cookieHeader : '');
  if (typeof cookies.admin_token === 'string' && cookies.admin_token.trim().length > 0) {
    return { token: cookies.admin_token.trim(), source: 'cookie' };
  }
  return { token: null, source: null };
}

function isProtectedOpsPath(pathname) {
  if (!pathname || typeof pathname !== 'string') return false;

  // Always protect admin UI + admin APIs.
  if (pathname.startsWith('/admin/')) return true;
  if (pathname.startsWith('/api/admin/')) return true;

  // Protect ops/admin APIs that are reachable from admin UI.
  if (pathname.startsWith('/api/phase')) {
    // Segment-based match: /api/phaseXX/(ops|admin|ops-console)/...
    const parts = pathname.split('/').filter(Boolean);
    if (parts.includes('admin')) return true;
    if (parts.includes('ops')) return true;
    // Covers ops-console, ops-assist, ops-decision, etc.
    if (parts.some((p) => typeof p === 'string' && p.startsWith('ops-'))) return true;
    // Phase5 state summary is ops-only data used by admin UI.
    if (pathname.startsWith('/api/phase5/state/')) return true;
  }

  return false;
}

function resolveRequestProto(req) {
  const xfProto = req && req.headers && req.headers['x-forwarded-proto'];
  if (typeof xfProto === 'string' && xfProto.trim().length > 0) return xfProto.split(',')[0].trim();
  if (req && req.socket && req.socket.encrypted) return 'https';
  return 'http';
}

function isSameOrigin(req) {
  const origin = req && req.headers && req.headers.origin;
  const host = req && req.headers && req.headers.host;
  if (typeof origin !== 'string' || origin.trim().length === 0) return false;
  if (typeof host !== 'string' || host.trim().length === 0) return false;
  let url;
  try {
    url = new URL(origin);
  } catch (_err) {
    return false;
  }
  const reqProto = resolveRequestProto(req);
  if (url.protocol !== `${reqProto}:`) return false;
  return url.host === host;
}

function isStateChangingMethod(method) {
  return method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
}

function isCsrfExemptPath(pathname) {
  return pathname === '/admin/login' || pathname === '/admin/login/';
}

function buildAdminCookieValue(token, req, opts) {
  const payload = opts && typeof opts === 'object' ? opts : {};
  const parts = [
    `admin_token=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax'
  ];
  const maxAgeSeconds = typeof payload.maxAgeSeconds === 'number' ? payload.maxAgeSeconds : null;
  if (maxAgeSeconds !== null) parts.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`);
  if (resolveRequestProto(req) === 'https') parts.push('Secure');
  return parts.join('; ');
}

function requireAdminToken(req, res, pathname) {
  const expected = resolveAdminOsToken();
  if (!expected) {
    // Fail closed on misconfiguration to remain safe even if Cloud Run IAM/network is mis-set.
    res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('admin auth not configured');
    return false;
  }

  const resolved = resolveAdminTokenFromRequest(req);
  const candidate = resolved && resolved.token ? resolved.token : null;
  const source = resolved && resolved.source ? resolved.source : null;
  if (candidate && timingSafeEqualString(candidate, expected)) {
    // CSRF guard: only enforce for cookie-authenticated state-changing requests.
    if (source === 'cookie' && isStateChangingMethod(req.method) && !isCsrfExemptPath(pathname)) {
      if (!isSameOrigin(req)) {
        res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: 'forbidden' }));
        return false;
      }
    }
    return true;
  }

  // Browser-friendly behavior for /admin/*.
  if (typeof pathname === 'string' && pathname.startsWith('/admin/')) {
    res.writeHead(302, { location: '/admin/login' });
    res.end();
    return false;
  }

  res.writeHead(401, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
  return false;
}

function getPathname(reqUrl) {
  if (!reqUrl) return '';
  const idx = reqUrl.indexOf('?');
  return idx === -1 ? reqUrl : reqUrl.slice(0, idx);
}

function getRequestId(req) {
  const headerId = req.headers['x-request-id'];
  if (typeof headerId === 'string' && headerId.length > 0) return headerId;
  const trace = req.headers['x-cloud-trace-context'];
  if (typeof trace === 'string' && trace.length > 0) {
    return trace.split('/')[0];
  }
  return crypto.randomUUID();
}

function serveHtml(res, filePath) {
  try {
    const html = fs.readFileSync(filePath, 'utf8');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('error');
  }
}

function handleWebhook(req, res) {
  const requestId = getRequestId(req);
  const signature = req.headers['x-line-signature'];

  let bytes = 0;
  const chunks = [];
  let tooLarge = false;

  req.on('data', (chunk) => {
    if (tooLarge) return;
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) {
      tooLarge = true;
      console.log(`[webhook] requestId=${requestId} reject=payload-too-large`);
      console.log(`[OBS] action=webhook result=reject requestId=${requestId}`); // WIP: Phase16-T01-OBS
      res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('payload too large');
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', async () => {
    if (tooLarge) return;
    const body = Buffer.concat(chunks).toString('utf8');
    try {
      const result = await handleLineWebhook({
        signature: typeof signature === 'string' ? signature : '',
        body,
        requestId,
        logger: (msg) => console.log(msg)
      });
      const obsResult = result.status >= 200 && result.status < 300 ? 'ok' : 'reject';
      const obsParts = [
        `[OBS] action=webhook result=${obsResult} requestId=${requestId}`
      ];
      if (result.firstUserId) obsParts.push(`lineUserId=${result.firstUserId}`);
      console.log(obsParts.join(' ')); // WIP: Phase16-T01-OBS
      res.writeHead(result.status, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(result.body);
    } catch (err) {
      console.log(`[webhook] requestId=${requestId} reject=exception`);
      console.log(`[OBS] action=webhook result=error requestId=${requestId}`); // WIP: Phase16-T01-OBS
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('server error');
    }
  });
}

function handleTrackClickRoute(req, res) {
  let bytes = 0;
  const chunks = [];
  let tooLarge = false;
  req.on('data', (chunk) => {
    if (tooLarge) return;
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) {
      tooLarge = true;
      res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('payload too large');
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', async () => {
    if (tooLarge) return;
    const body = Buffer.concat(chunks).toString('utf8');
    try {
      const { handleTrackClick } = require('./routes/trackClick');
      await handleTrackClick(req, res, body);
    } catch (err) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    }
  });
}

function createServer() {
  return http.createServer((req, res) => {
  const pathname = getPathname(req.url);
  const SERVICE_MODE = getServiceMode();

  if (req.method === 'GET' && (pathname === '/healthz' || pathname === '/healthz/')) {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, env: ENV_NAME }));
    return;
  }

  if (SERVICE_MODE === 'track') {
    if (req.method === 'GET' && pathname.startsWith('/t/')) {
      const token = pathname.slice(3);
      const { handleTrackClickGet } = require('./routes/trackClickGet');
      handleTrackClickGet(req, res, token).catch(() => {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('error');
      });
      return;
    }
    if (req.method === 'POST' && pathname === '/track/click') {
      handleTrackClickRoute(req, res);
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }

  if (SERVICE_MODE === 'webhook') {
    if (req.method === 'POST' && (pathname === '/webhook/line' || pathname === '/webhook/line/')) {
      handleWebhook(req, res);
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }

  // Member service: protect admin/ops surfaces at the app layer to remain safe even if IAM/network is misconfigured.
  if (isProtectedOpsPath(pathname)) {
    // Allow reaching the login/logout endpoints without prior auth.
    if (pathname !== '/admin/login' && pathname !== '/admin/login/' && pathname !== '/admin/logout' && pathname !== '/admin/logout/') {
      if (!requireAdminToken(req, res, pathname)) return;
    }
  }

  if (pathname === '/api/phase1/events') {
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('payload too large');
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });
    const { handlePhase1Event } = require('./routes/phase1Events');
    (async () => {
      if (req.method === 'POST') {
        const body = await collectBody();
        await handlePhase1Event(req, res, body);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (req.method === 'POST' && (pathname === '/webhook/line' || pathname === '/webhook/line/')) {
    handleWebhook(req, res);
    return;
  }

  if (req.method === 'GET' && (pathname === '/admin' || pathname === '/admin/')) {
    res.writeHead(302, { location: '/admin/ops' });
    res.end();
    return;
  }

  if (req.method === 'GET' && (pathname === '/admin/login' || pathname === '/admin/login/')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Admin Login</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 16px; color: #222; }
      label { display: block; margin: 8px 0; }
      input { padding: 6px 8px; font-size: 14px; min-width: 280px; }
      button { padding: 6px 10px; font-size: 14px; }
      .note { font-size: 12px; color: #666; margin-bottom: 12px; }
    </style>
  </head>
  <body>
    <h1>Admin Login</h1>
    <div class="note">Enter the admin token to access /admin/* and ops/admin APIs.</div>
    <form method="post" action="/admin/login">
      <label>
        token
        <input type="password" name="token" required />
      </label>
      <button type="submit">Login</button>
    </form>
  </body>
</html>`);
    return;
  }

  if (req.method === 'POST' && (pathname === '/admin/login' || pathname === '/admin/login/')) {
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    req.on('data', (chunk) => {
      if (tooLarge) return;
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        tooLarge = true;
        res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('payload too large');
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) return;
      const body = Buffer.concat(chunks).toString('utf8');
      const expected = resolveAdminOsToken();
      if (!expected) {
        res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('admin auth not configured');
        return;
      }

      let token = null;
      const contentType = req.headers['content-type'] || '';
      if (typeof contentType === 'string' && contentType.includes('application/json')) {
        try {
          const parsed = JSON.parse(body || '{}');
          if (parsed && typeof parsed.token === 'string') token = parsed.token.trim();
        } catch (_err) {
          token = null;
        }
      } else {
        try {
          const params = new URLSearchParams(body);
          const raw = params.get('token');
          if (typeof raw === 'string') token = raw.trim();
        } catch (_err) {
          token = null;
        }
      }

      if (!token || !timingSafeEqualString(token, expected)) {
        res.writeHead(401, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('unauthorized');
        return;
      }

  // Cookie-based session avoids clashing with Cloud Run IAM's Authorization: Bearer header.
      res.writeHead(302, {
        location: '/admin/ops',
        // Short-lived session cookie. Secure is set automatically when behind HTTPS.
        'set-cookie': buildAdminCookieValue(token, req, { maxAgeSeconds: 60 * 60 * 8 })
      });
      res.end();
    });
    return;
  }

  if (req.method === 'GET' && (pathname === '/admin/logout' || pathname === '/admin/logout/')) {
    res.writeHead(302, {
      location: '/admin/login',
      'set-cookie': buildAdminCookieValue('', req, { maxAgeSeconds: 0 })
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && (pathname === '/admin/ops' || pathname === '/admin/ops/')) {
    const filePath = path.resolve(__dirname, '..', 'apps', 'admin', 'ops_readonly.html');
    serveHtml(res, filePath);
    return;
  }

  if (req.method === 'GET' && (pathname === '/admin/review' || pathname === '/admin/review/')) {
    const filePath = path.resolve(__dirname, '..', 'apps', 'admin', 'review.html');
    serveHtml(res, filePath);
    return;
  }

  if (req.method === 'GET' && (pathname === '/admin/composer' || pathname === '/admin/composer/')) {
    const filePath = path.resolve(__dirname, '..', 'apps', 'admin', 'composer.html');
    serveHtml(res, filePath);
    return;
  }

  if (req.method === 'GET' && (pathname === '/admin/monitor' || pathname === '/admin/monitor/')) {
    const filePath = path.resolve(__dirname, '..', 'apps', 'admin', 'monitor.html');
    serveHtml(res, filePath);
    return;
  }

  if (req.method === 'GET' && (pathname === '/admin/errors' || pathname === '/admin/errors/')) {
    const filePath = path.resolve(__dirname, '..', 'apps', 'admin', 'errors.html');
    serveHtml(res, filePath);
    return;
  }

  if (req.method === 'GET' && (pathname === '/admin/master' || pathname === '/admin/master/')) {
    const filePath = path.resolve(__dirname, '..', 'apps', 'admin', 'master.html');
    serveHtml(res, filePath);
    return;
  }

  if (req.method === 'GET' && pathname === '/admin/implementation-targets') {
    const { handleImplementationTargets } = require('./routes/admin/implementationTargets');
    handleImplementationTargets(req, res);
    return;
  }

  if (req.method === 'GET' && (pathname === '/api/admin/trace' || pathname === '/api/admin/trace/')) {
    const { handleAdminTraceSearch } = require('./routes/admin/traceSearch');
    handleAdminTraceSearch(req, res);
    return;
  }

  if (req.method === 'POST' && (pathname === '/api/admin/ridac-membership/unlink' || pathname === '/api/admin/ridac-membership/unlink/')) {
    const { handleRidacMembershipUnlink } = require('./routes/admin/ridacMembershipUnlink');
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: 'payload too large' }));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    (async () => {
      const body = await collectBody();
      await handleRidacMembershipUnlink(req, res, body);
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'error' }));
    });
    return;
  }

  if (pathname.startsWith('/api/admin/os/')) {
    const { handleStatus, handlePlan, handleSet } = require('./routes/admin/osKillSwitch');
    const { handleErrorsSummary } = require('./routes/admin/osErrors');
    const {
      handleDraft,
      handlePreview,
      handleApprove,
      handleSendPlan,
      handleSendExecute
    } = require('./routes/admin/osNotifications');
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: 'payload too large' }));
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });

    (async () => {
      if (req.method === 'GET' && pathname === '/api/admin/os/kill-switch/status') {
        await handleStatus(req, res);
        return;
      }
      if (req.method === 'POST' && pathname === '/api/admin/os/kill-switch/plan') {
        const body = await collectBody();
        await handlePlan(req, res, body);
        return;
      }
      if (req.method === 'POST' && pathname === '/api/admin/os/kill-switch/set') {
        const body = await collectBody();
        await handleSet(req, res, body);
        return;
      }
      if (req.method === 'GET' && pathname === '/api/admin/os/errors/summary') {
        await handleErrorsSummary(req, res);
        return;
      }
      if (req.method === 'POST' && pathname === '/api/admin/os/notifications/draft') {
        const body = await collectBody();
        await handleDraft(req, res, body);
        return;
      }
      if (req.method === 'POST' && pathname === '/api/admin/os/notifications/preview') {
        const body = await collectBody();
        await handlePreview(req, res, body);
        return;
      }
      if (req.method === 'POST' && pathname === '/api/admin/os/notifications/approve') {
        const body = await collectBody();
        await handleApprove(req, res, body);
        return;
      }
      if (req.method === 'POST' && pathname === '/api/admin/os/notifications/send/plan') {
        const body = await collectBody();
        await handleSendPlan(req, res, body);
        return;
      }
      if (req.method === 'POST' && pathname === '/api/admin/os/notifications/send/execute') {
        const body = await collectBody();
        await handleSendExecute(req, res, body);
        return;
      }

      res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'not found' }));
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'error' }));
    });
    return;
  }

  if (pathname.startsWith('/api/phase4/admin/')) {
    const { handleUsersSummary, handleNotificationsSummary } = require('./routes/admin/opsOverview');
    (async () => {
      if (req.method === 'GET' && pathname === '/api/phase4/admin/users-summary') {
        await handleUsersSummary(req, res);
        return;
      }
      if (req.method === 'GET' && pathname === '/api/phase4/admin/notifications-summary') {
        await handleNotificationsSummary(req, res);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase5/admin/ops/')) {
    const { handleOpsReview } = require('./routes/phase5Review');
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('payload too large');
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });
    (async () => {
      if (req.method === 'POST' && pathname === '/api/phase5/admin/ops/review') {
        const body = await collectBody();
        await handleOpsReview(req, res, body);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase5/admin/users/')) {
    const { handleUserReview } = require('./routes/phase5AdminUsers');
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('payload too large');
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });
    (async () => {
      if (req.method === 'POST' && pathname === '/api/phase5/admin/users/review') {
        const body = await collectBody();
        await handleUserReview(req, res, body);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase5/state/')) {
    const { handleUserStateSummary } = require('./routes/phase5State');
    (async () => {
      if (req.method === 'GET' && pathname === '/api/phase5/state/summary') {
        await handleUserStateSummary(req, res);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase5/ops/')) {
    const {
      handleUsersSummaryFiltered,
      handleNotificationsSummaryFiltered,
      handleStaleMemberNumber
    } = require('./routes/phase5Ops');
    (async () => {
      if (req.method === 'GET' && pathname === '/api/phase5/ops/users-summary') {
        await handleUsersSummaryFiltered(req, res);
        return;
      }
      if (req.method === 'GET' && pathname === '/api/phase5/ops/notifications-summary') {
        await handleNotificationsSummaryFiltered(req, res);
        return;
      }
      if (req.method === 'GET' && pathname === '/api/phase5/ops/member-number-stale') {
        await handleStaleMemberNumber(req, res);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase24/ops/decision-logs')) {
    const {
      handleAppendDecisionLog,
      handleLatestDecision,
      handleListDecisions
    } = require('./routes/phase24DecisionLogs');
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('payload too large');
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });
    (async () => {
      if (req.method === 'POST' && pathname === '/api/phase24/ops/decision-logs') {
        const body = await collectBody();
        await handleAppendDecisionLog(req, res, body);
        return;
      }
      if (req.method === 'GET' && pathname === '/api/phase24/ops/decision-logs/latest') {
        await handleLatestDecision(req, res);
        return;
      }
      if (req.method === 'GET' && pathname === '/api/phase24/ops/decision-logs') {
        await handleListDecisions(req, res);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase24/ops-state')) {
    const { handleUpsertOpsState, handleGetOpsState } = require('./routes/phase24OpsState');
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('payload too large');
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });
    (async () => {
      if (req.method === 'POST' && pathname === '/api/phase24/ops-state') {
        const body = await collectBody();
        await handleUpsertOpsState(req, res, body);
        return;
      }
      if (req.method === 'GET' && pathname === '/api/phase24/ops-state') {
        await handleGetOpsState(req, res);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase25/ops/console')) {
    const { handleGetOpsConsole } = require('./routes/phase25OpsConsole');
    (async () => {
      if (req.method === 'GET' && pathname === '/api/phase25/ops/console') {
        await handleGetOpsConsole(req, res);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase25/ops/decision')) {
    const { handleSubmitOpsDecision } = require('./routes/phase25OpsDecision');
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('payload too large');
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });
    (async () => {
      if (req.method === 'POST' && pathname === '/api/phase25/ops/decision') {
        const body = await collectBody();
        await handleSubmitOpsDecision(req, res, body);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase26/ops-console')) {
    const { handleOpsConsoleList } = require('./routes/phase26OpsConsoleList');
    (async () => {
      if (req.method === 'GET' && pathname === '/api/phase26/ops-console/list') {
        await handleOpsConsoleList(req, res);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase42/ops-console')) {
    const { handleOpsConsoleView } = require('./routes/phase42OpsConsoleView');
    (async () => {
      if (req.method === 'GET' && pathname === '/api/phase42/ops-console/view') {
        await handleOpsConsoleView(req, res);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase105/ops-assist')) {
    const { handleOpsAssistAdopt } = require('./routes/phase105OpsAssistAdopt');
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('payload too large');
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });
    (async () => {
      if (req.method === 'POST' && pathname === '/api/phase105/ops-assist/adopt') {
        const body = await collectBody();
        await handleOpsAssistAdopt(req, res, body);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase121/ops/notice')) {
    const { handleOpsNoticeSend } = require('./routes/phase121OpsNoticeSend');
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('payload too large');
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });
    (async () => {
      if (req.method === 'POST' && pathname === '/api/phase121/ops/notice/send') {
        const body = await collectBody();
        await handleOpsNoticeSend(req, res, body);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase36/notice')) {
    const { handleNoticeSend } = require('./routes/phase36NoticeSend');
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('payload too large');
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });
    (async () => {
      if (req.method === 'POST' && pathname === '/api/phase36/notice/send') {
        const body = await collectBody();
        await handleNoticeSend(req, res, body);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase37/deliveries')) {
    const { handleMarkRead, handleMarkClick } = require('./routes/phase37DeliveryReactions');
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('payload too large');
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });
    (async () => {
      if (req.method === 'POST' && pathname === '/api/phase37/deliveries/mark-read') {
        const body = await collectBody();
        await handleMarkRead(req, res, body);
        return;
      }
      if (req.method === 'POST' && pathname === '/api/phase37/deliveries/mark-click') {
        const body = await collectBody();
        await handleMarkClick(req, res, body);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase38/ops/dashboard')) {
    const { handleOpsDashboard } = require('./routes/phase38OpsDashboard');
    (async () => {
      if (req.method === 'GET' && pathname === '/api/phase38/ops/dashboard') {
        await handleOpsDashboard(req, res);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase39/ops-assist')) {
    const { handleOpsAssistSuggestion } = require('./routes/phase39OpsAssistSuggestion');
    (async () => {
      if (req.method === 'GET' && pathname === '/api/phase39/ops-assist/suggestion') {
        await handleOpsAssistSuggestion(req, res);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase32/ops-decision')) {
    const { handleSuggestOpsDecision } = require('./routes/phase32OpsDecisionSuggest');
    (async () => {
      if (req.method === 'GET' && pathname === '/api/phase32/ops-decision/suggest') {
        await handleSuggestOpsDecision(req, res);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase33/ops-decision')) {
    const { handleExecuteOpsDecision } = require('./routes/phase33OpsDecisionExecute');
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('payload too large');
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });
    (async () => {
      if (req.method === 'POST' && pathname === '/api/phase33/ops-decision/execute') {
        const body = await collectBody();
        await handleExecuteOpsDecision(req, res, body);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase47/automation')) {
    const { handleAutomationDryRun } = require('./routes/phase47AutomationDryRun');
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('payload too large');
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });
    (async () => {
      if (req.method === 'POST' && pathname === '/api/phase47/automation/dry-run') {
        const body = await collectBody();
        await handleAutomationDryRun(req, res, body);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase48/automation')) {
    const { handleAutomationConfig } = require('./routes/phase48AutomationConfig');
    (async () => {
      if (req.method === 'GET' && pathname === '/api/phase48/automation/config') {
        await handleAutomationConfig(req, res);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase52/ops/batch')) {
    const { handleOpsBatch } = require('./routes/phase52OpsBatch');
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('payload too large');
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });
    (async () => {
      if (req.method === 'POST' && pathname === '/api/phase52/ops/batch/run') {
        const body = await collectBody();
        await handleOpsBatch(req, res, body);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase61/templates')) {
    const { handleTemplates } = require('./routes/phase61Templates');
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('payload too large');
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });
    (async () => {
      if (req.method === 'GET') {
        await handleTemplates(req, res, '', pathname);
        return;
      }
      if (req.method === 'POST' || req.method === 'PATCH') {
        const body = await collectBody();
        await handleTemplates(req, res, body, pathname);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase62/ops/report')) {
    const { handleOpsDailyReport } = require('./routes/phase62OpsDailyReport');
    (async () => {
      if (req.method === 'POST' && pathname === '/api/phase62/ops/report/daily') {
        await handleOpsDailyReport(req, res);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase65/ops/jobs')) {
    const { handleOpsDailyJob } = require('./routes/phase65OpsDailyJob');
    (async () => {
      if (req.method === 'POST' && pathname === '/api/phase65/ops/jobs/daily-report') {
        await handleOpsDailyJob(req, res);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase66/segments')) {
    const { handleSendTargets } = require('./routes/phase66Segments');
    (async () => {
      if (req.method === 'GET' && pathname === '/api/phase66/segments/send-targets') {
        await handleSendTargets(req, res);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase67/send')) {
    const { handlePlanSend } = require('./routes/phase67PlanSend');
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('payload too large');
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });
    (async () => {
      if (req.method === 'POST' && pathname === '/api/phase67/send/plan') {
        const body = await collectBody();
        await handlePlanSend(req, res, body);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase68/send')) {
    const { handleExecuteSend } = require('./routes/phase68ExecuteSend');
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('payload too large');
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });
    (async () => {
      if (req.method === 'POST' && pathname === '/api/phase68/send/execute') {
        const body = await collectBody();
        await handleExecuteSend(req, res, body);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase81/segment-send')) {
    const { handleDryRun } = require('./routes/phase81DryRun');
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('payload too large');
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });
    (async () => {
      if (req.method === 'POST' && pathname === '/api/phase81/segment-send/dry-run') {
        const body = await collectBody();
        await handleDryRun(req, res, body);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (req.method === 'GET' && pathname.startsWith('/api/phase90/automation-runs/')) {
    const runId = pathname.replace('/api/phase90/automation-runs/', '').replace(/\/+$/, '');
    const { handleRunStatus } = require('./routes/phase90RunStatus');
    handleRunStatus(req, res, runId);
    return;
  }

  if (pathname.startsWith('/api/phase77/segments')) {
    const { handleSegments } = require('./routes/phase77Segments');
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('payload too large');
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });
    (async () => {
      if (req.method === 'GET' && pathname === '/api/phase77/segments') {
        await handleSegments(req, res, '', pathname);
        return;
      }
      if (req.method === 'POST' && pathname === '/api/phase77/segments') {
        const body = await collectBody();
        await handleSegments(req, res, body, pathname);
        return;
      }
      if (req.method === 'GET' && pathname.startsWith('/api/phase77/segments/')) {
        await handleSegments(req, res, '', pathname);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase73/retry-queue')) {
    const { handleListRetryQueue, handleRetrySend } = require('./routes/phase73RetryQueue');
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('payload too large');
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });
    (async () => {
      if (req.method === 'GET' && pathname === '/api/phase73/retry-queue') {
        await handleListRetryQueue(req, res);
        return;
      }
      if (req.method === 'POST' && pathname === '/api/phase73/retry-queue/retry') {
        const body = await collectBody();
        await handleRetrySend(req, res, body);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/api/phase6/member/')) {
    const { handlePhase6MemberSummary } = require('./routes/phase6MemberSummary');
    (async () => {
      if (req.method === 'GET' && pathname === '/api/phase6/member/summary') {
        await handlePhase6MemberSummary(req, res);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/admin/read-model')) {
    const { handleNotificationReadModel } = require('./routes/admin/readModel');
    (async () => {
      if (req.method === 'GET' && (pathname === '/admin/read-model' || pathname === '/admin/read-model/')) {
        const filePath = path.resolve(__dirname, '..', 'apps', 'admin', 'read_model.html');
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(fs.readFileSync(filePath, 'utf8'));
        return;
      }
      if (req.method === 'GET' && pathname === '/admin/read-model/notifications') {
        await handleNotificationReadModel(req, res);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/admin/phase2/automation')) {
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('payload too large');
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });

    const { handleRunPhase2 } = require('./routes/admin/phase2Automation');

    (async () => {
      if (req.method === 'POST' && pathname === '/admin/phase2/automation/run') {
        const body = await collectBody();
        await handleRunPhase2(req, res, body);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/admin/phase1/notifications')) {
    const match = pathname.match(/^\/admin\/phase1\/notifications(?:\/([^/]+)(?:\/(send))?)?\/?$/);
    const notificationId = match && match[1] ? match[1] : null;
    const action = match && match[2] ? match[2] : null;
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('payload too large');
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });

    const { handleCreatePhase1, handleSendPhase1 } = require('./routes/admin/phase1Notifications');

    (async () => {
      if (req.method === 'POST' && pathname === '/admin/phase1/notifications') {
        const body = await collectBody();
        await handleCreatePhase1(req, res, body);
        return;
      }
      if (req.method === 'POST' && action === 'send' && notificationId) {
        const body = await collectBody();
        await handleSendPhase1(req, res, body, notificationId);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/admin/notifications')) {
    const match = pathname.match(/^\/admin\/notifications(?:\/([^/]+)(?:\/(test-send|send))?)?\/?$/);
    const notificationId = match && match[1] ? match[1] : null;
    const action = match && match[2] ? match[2] : null;
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('payload too large');
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });

    const { handleCreate, handleList, handleTestSend, handleSend } = require('./routes/admin/notifications');

    (async () => {
      if (req.method === 'GET' && pathname === '/admin/notifications') {
        await handleList(req, res);
        return;
      }
      if (req.method === 'POST' && pathname === '/admin/notifications') {
        const body = await collectBody();
        await handleCreate(req, res, body);
        return;
      }
      if (req.method === 'POST' && action === 'test-send' && notificationId) {
        const body = await collectBody();
        await handleTestSend(req, res, body, notificationId);
        return;
      }
      if (req.method === 'POST' && action === 'send' && notificationId) {
        const body = await collectBody();
        await handleSend(req, res, body, notificationId);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (pathname.startsWith('/admin/link-registry')) {
    const match = pathname.match(/^\/admin\/link-registry\/?([^/]*)?(?:\/health)?\/?$/);
    const linkId = match && match[1] ? match[1] : null;
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    const collectBody = () => new Promise((resolve) => {
      req.on('data', (chunk) => {
        if (tooLarge) return;
        bytes += chunk.length;
        if (bytes > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('payload too large');
          req.destroy();
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf8'));
      });
    });

    const { handleCreate, handleList, handleUpdate, handleDelete, handleHealth } = require('./routes/admin/linkRegistry');

    (async () => {
      if (req.method === 'GET' && pathname === '/admin/link-registry') {
        await handleList(req, res);
        return;
      }
      if (req.method === 'POST' && pathname === '/admin/link-registry') {
        const body = await collectBody();
        await handleCreate(req, res, body);
        return;
      }
      if (req.method === 'PATCH' && linkId) {
        const body = await collectBody();
        await handleUpdate(req, res, body, linkId);
        return;
      }
      if (req.method === 'DELETE' && linkId) {
        await handleDelete(req, res, linkId);
        return;
      }
      if (req.method === 'POST' && pathname.endsWith('/health') && linkId) {
        const body = await collectBody();
        await handleHealth(req, res, body, linkId);
        return;
      }
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
    })().catch(() => {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('error');
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/admin/kill-switch') {
    let bytes = 0;
    const chunks = [];
    let tooLarge = false;
    req.on('data', (chunk) => {
      if (tooLarge) return;
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        tooLarge = true;
        res.writeHead(413, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('payload too large');
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', async () => {
      if (tooLarge) return;
      const body = Buffer.concat(chunks).toString('utf8');
      try {
        const { handleSetKillSwitch } = require('./routes/admin/killSwitch');
        await handleSetKillSwitch(req, res, body);
      } catch (err) {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('error');
      }
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/track/click') {
    handleTrackClickRoute(req, res);
    return;
  }

  if (SERVICE_MODE !== 'webhook' && req.method === 'GET' && pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('ok');
    return;
  }

  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('not found');
  });
}

const server = createServer();

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`[boot] listening on :${PORT} env=${ENV_NAME} mode=${getServiceMode()}`);
  });
}

module.exports = { server, createServer };
