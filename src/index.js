'use strict';

const http = require('http');
const crypto = require('crypto');
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
      res.writeHead(result.status, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(result.body);
    } catch (err) {
      console.log(`[webhook] requestId=${requestId} reject=exception`);
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

  if (req.method === 'POST' && (pathname === '/webhook/line' || pathname === '/webhook/line/')) {
    handleWebhook(req, res);
    return;
  }

  if (req.method === 'POST' && pathname.startsWith('/admin/notifications/')) {
    const match = pathname.match(/^\/admin\/notifications\/([^/]+)\/test-send\/?$/);
    if (!match) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }
    const notificationId = match[1];
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
        const { handleTestSend } = require('./routes/admin/notifications');
        await handleTestSend(req, res, body, notificationId);
      } catch (err) {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('error');
      }
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
