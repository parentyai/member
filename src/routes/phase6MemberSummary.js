'use strict';

const { getMemberSummary } = require('../usecases/phase6/getMemberSummary');

async function handlePhase6MemberSummary(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const lineUserId = url.searchParams.get('lineUserId');
  if (!lineUserId) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('lineUserId required');
    return;
  }

  const summary = await getMemberSummary({ lineUserId });
  if (!summary) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('user not found');
    return;
  }

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(summary));
}

module.exports = {
  handlePhase6MemberSummary
};
