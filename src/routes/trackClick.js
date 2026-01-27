'use strict';

const { recordClickAndRedirect } = require('../usecases/track/recordClickAndRedirect');

function parseJson(body, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (err) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('invalid json');
    return null;
  }
}

async function handleTrackClick(req, res, body) {
  const payload = parseJson(body, res);
  if (!payload) return;
  try {
    const result = await recordClickAndRedirect({
      deliveryId: payload.deliveryId,
      linkRegistryId: payload.linkRegistryId,
      at: payload.at
    });
    res.writeHead(302, { location: result.url });
    res.end();
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    if (message.includes('required') || message.includes('not found')) {
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(message);
      return;
    }
    if (message.includes('WARN')) {
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('link health WARN');
      return;
    }
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('error');
  }
}

module.exports = {
  handleTrackClick
};
