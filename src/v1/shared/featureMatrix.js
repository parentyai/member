'use strict';

const { resolveBooleanEnvFlag } = require('./flags');

function resolveV1FeatureMatrix(env) {
  const source = env && typeof env === 'object' ? env : process.env;
  return {
    channelEdge: resolveBooleanEnvFlag('ENABLE_V1_CHANNEL_EDGE', false, source),
    fastSlowDispatch: resolveBooleanEnvFlag('ENABLE_V1_FAST_SLOW_DISPATCH', false, source),
    liffSyntheticEvents: resolveBooleanEnvFlag('ENABLE_V1_LIFF_SYNTHETIC_EVENTS', false, source),
    openAiResponses: resolveBooleanEnvFlag('ENABLE_V1_OPENAI_RESPONSES', true, source),
    semanticObjectStrict: resolveBooleanEnvFlag('ENABLE_V1_SEMANTIC_OBJECT_STRICT', false, source),
    memoryFabric: resolveBooleanEnvFlag('ENABLE_V1_MEMORY_FABRIC', false, source),
    actionGateway: resolveBooleanEnvFlag('ENABLE_V1_ACTION_GATEWAY', false, source),
    lineRenderer: resolveBooleanEnvFlag('ENABLE_V1_LINE_RENDERER', false, source),
    evidenceLedger: resolveBooleanEnvFlag('ENABLE_V1_EVIDENCE_LEDGER', false, source),
    replayGates: resolveBooleanEnvFlag('ENABLE_V1_REPLAY_GATES', false, source)
  };
}

module.exports = {
  resolveV1FeatureMatrix
};
