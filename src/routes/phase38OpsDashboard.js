'use strict';

const { getOpsDashboard } = require('../usecases/phase38/getOpsDashboard');

function parseLimit(reqUrl) {
  if (!reqUrl) return null;
  const query = reqUrl.split('?')[1];
  if (!query) return null;
  const params = new URLSearchParams(query);
  const limit = params.get('limit');
  return limit ? Number(limit) : null;
}

async function handleOpsDashboard(req, res) {
  try {
    const limit = parseLimit(req.url);
    const result = await getOpsDashboard({ limit });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error' }));
  }
}

module.exports = {
  handleOpsDashboard
};
