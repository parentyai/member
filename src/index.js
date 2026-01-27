'use strict';

const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8080);
const ENV_NAME = process.env.ENV_NAME || 'local';
const SERVICE_MODE = process.env.SERVICE_MODE || 'member';
const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';
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

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifyLineSignature(secret, body, signature) {
  if (!secret || !signature) return false;
  const hmac = crypto.createHmac('sha256', secret).update(body).digest('base64');
  const actual = Buffer.from(signature);
  const expected = Buffer.from(hmac);
  return timingSafeEqual(actual, expected);
}

function handleWebhook(req, res) {
  const requestId = getRequestId(req);
  if (!LINE_CHANNEL_SECRET) {
    console.log(`[webhook] requestId=${requestId} reject=missing-secret`);
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('server misconfigured');
    return;
  }
  const signature = req.headers['x-line-signature'];
  if (typeof signature !== 'string' || signature.length === 0) {
    console.log(`[webhook] requestId=${requestId} reject=missing-signature`);
    res.writeHead(401, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('unauthorized');
    return;
  }

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

  req.on('end', () => {
    if (tooLarge) return;
    const body = Buffer.concat(chunks).toString('utf8');
    const ok = verifyLineSignature(LINE_CHANNEL_SECRET, body, signature);
    if (!ok) {
      console.log(`[webhook] requestId=${requestId} reject=invalid-signature`);
      res.writeHead(401, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('unauthorized');
      return;
    }
    console.log(`[webhook] requestId=${requestId} accept`);
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('ok');
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
