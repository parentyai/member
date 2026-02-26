'use strict';

const emergencyProvidersRepo = require('../../repos/firestore/emergencyProvidersRepo');
const { resolveDefaultProviders } = require('./constants');

async function ensureEmergencyProviders(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const traceId = typeof payload.traceId === 'string' && payload.traceId.trim() ? payload.traceId.trim() : null;
  const providers = resolveDefaultProviders();
  const results = [];
  for (const provider of providers) {
    const item = Object.assign({}, provider, { traceId });
    const result = await emergencyProvidersRepo.createProviderIfMissing(item);
    results.push(Object.assign({}, result, { providerKey: provider.providerKey }));
  }
  return {
    ok: true,
    ensured: results,
    count: results.length
  };
}

module.exports = {
  ensureEmergencyProviders
};
