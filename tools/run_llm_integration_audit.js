'use strict';

const path = require('node:path');
const { parseArgs, readJson, writeJson } = require('./llm_quality/lib');

function normalizeSummary(payload) {
  return payload && typeof payload === 'object'
    ? (payload.summary && typeof payload.summary === 'object' ? payload.summary : payload)
    : {};
}

function buildObservedSystems(integrationKpis) {
  const kpis = integrationKpis && typeof integrationKpis === 'object' ? integrationKpis : {};
  return {
    cityPack: { observed: Number((kpis.cityPackGroundingRate && kpis.cityPackGroundingRate.sampleCount) || 0) > 0 },
    emergency: { observed: Number((kpis.emergencyOfficialSourceRate && kpis.emergencyOfficialSourceRate.sampleCount) || 0) > 0 },
    journey: { observed: Number((kpis.journeyAlignedActionRate && kpis.journeyAlignedActionRate.sampleCount) || 0) > 0 },
    savedFaq: { observed: Number((kpis.savedFaqReusePassRate && kpis.savedFaqReusePassRate.sampleCount) || 0) > 0 },
    trace: { observed: Number((kpis.traceJoinCompleteness && kpis.traceJoinCompleteness.sampleCount) || 0) > 0 }
  };
}

function main(argv) {
  const args = parseArgs(argv);
  const root = process.cwd();
  const summaryPath = path.resolve(root, args.summary || 'tmp/llm_usage_summary.json');
  const outputPath = path.resolve(root, args.output || 'tmp/llm_integration_audit.json');
  const summaryPayload = normalizeSummary(readJson(summaryPath));
  const qualityFramework = summaryPayload && summaryPayload.qualityFramework && typeof summaryPayload.qualityFramework === 'object'
    ? summaryPayload.qualityFramework
    : {};
  const qualityLoopV2 = qualityFramework.qualityLoopV2 && typeof qualityFramework.qualityLoopV2 === 'object'
    ? qualityFramework.qualityLoopV2
    : {};
  const integrationKpis = qualityLoopV2.integrationKpis && typeof qualityLoopV2.integrationKpis === 'object'
    ? qualityLoopV2.integrationKpis
    : {};
  const criticalSlices = Array.isArray(qualityLoopV2.criticalSlices) ? qualityLoopV2.criticalSlices : [];
  const missingMeasurements = Object.entries(integrationKpis)
    .filter(([, value]) => value && typeof value === 'object' && value.status === 'missing')
    .map(([key]) => key);

  const payload = {
    auditVersion: 'v2',
    generatedAt: new Date().toISOString(),
    source: {
      summaryPath
    },
    rolloutStage: qualityLoopV2.rolloutStage || 'log_only',
    observedSystems: buildObservedSystems(integrationKpis),
    integrationKpis,
    criticalSlices,
    missingMeasurements,
    missingJoins: Array.isArray(qualityLoopV2.missingJoins) ? qualityLoopV2.missingJoins : missingMeasurements
  };
  writeJson(outputPath, payload);
  process.stdout.write(`${JSON.stringify({ ok: true, outputPath, missingMeasurements }, null, 2)}\n`);
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  buildObservedSystems,
  main
};
