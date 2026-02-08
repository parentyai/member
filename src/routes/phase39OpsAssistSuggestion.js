'use strict';

const { getOpsAssistSuggestion } = require('../usecases/phase39/getOpsAssistSuggestion');

function parseLineUserId(reqUrl) {
  if (!reqUrl) return null;
  const query = reqUrl.split('?')[1];
  if (!query) return null;
  const params = new URLSearchParams(query);
  return params.get('lineUserId');
}

async function handleOpsAssistSuggestion(req, res) {
  try {
    const lineUserId = parseLineUserId(req.url);
    const result = await getOpsAssistSuggestion({ lineUserId });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    if (message.includes('required')) {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: message }));
      return;
    }
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error' }));
  }
}

module.exports = {
  handleOpsAssistSuggestion
};
