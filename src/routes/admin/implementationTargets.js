'use strict';

const { listImplementationTargets } = require('../../domain/implementationTargets');
const { buildOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

const ROUTE_TYPE = 'admin_route';
const ROUTE_KEY = 'admin.implementation_targets';

function applyOutcome(res, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const outcome = buildOutcome(null, Object.assign({}, opts, {
    routeType: ROUTE_TYPE,
    guard: Object.assign({}, opts.guard || {}, { routeKey: ROUTE_KEY })
  }));
  applyOutcomeHeaders(res, outcome);
}

async function handleImplementationTargets(req, res) {
  try {
    const items = listImplementationTargets();
    applyOutcome(res, {
      state: 'success',
      reason: 'completed'
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(items));
  } catch (err) {
    applyOutcome(res, {
      state: 'error',
      reason: 'error'
    });
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('error');
  }
}

module.exports = {
  handleImplementationTargets
};
