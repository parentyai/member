'use strict';

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { handleLineWebhook } = require('./routes/webhookLine');

const PORT = Number(process.env.PORT || 8080);
const ENV_NAME = process.env.ENV_NAME || 'local';
const SERVICE_MODE = process.env.SERVICE_MODE || 'member';
const MAX_BODY_BYTES = 1024 * 1024;

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

const server = http.createServer((req, res) => {
  const pathname = getPathname(req.url);

  if (req.method === 'GET' && (pathname === '/healthz' || pathname === '/healthz/')) {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, env: ENV_NAME }));
    return;
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

  if (req.method === 'GET' && pathname === '/admin/implementation-targets') {
    const { handleImplementationTargets } = require('./routes/admin/implementationTargets');
    handleImplementationTargets(req, res);
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

server.listen(PORT, () => {
  console.log(`[boot] listening on :${PORT} env=${ENV_NAME} mode=${SERVICE_MODE}`);
});

module.exports = { server };
