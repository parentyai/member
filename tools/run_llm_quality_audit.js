'use strict';

const path = require('node:path');
const { parseArgs, readJson, writeJson } = require('./llm_quality/lib');

function uniqueList(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === 'string' && value.trim())));
}

function normalizeSummary(payload) {
  return payload && typeof payload === 'object'
    ? (payload.summary && typeof payload.summary === 'object' ? payload.summary : payload)
    : {};
}

function deriveNextAuditFocus(report, integration) {
  const focus = [];
  const hardFailures = Array.isArray(report.hard_gate_failures) ? report.hard_gate_failures : [];
  if (hardFailures.some((item) => String(item).includes('critical_slice'))) focus.push('critical_slices');
  if (hardFailures.some((item) => String(item).includes('compat'))) focus.push('compat_governance');
  if (integration && Array.isArray(integration.missingMeasurements) && integration.missingMeasurements.length > 0) {
    focus.push('missing_integration_measurements');
  }
  if (Array.isArray(report.top_10_loop_cases) && report.top_10_loop_cases.length > 0) focus.push('loop_prevention');
  if (Array.isArray(report.top_10_context_loss_cases) && report.top_10_context_loss_cases.length > 0) focus.push('context_continuity');
  return uniqueList(focus);
}

function main(argv) {
  const args = parseArgs(argv);
  const root = process.cwd();
  const summaryPath = path.resolve(root, args.summary || 'tmp/llm_usage_summary.json');
  const reportPath = path.resolve(root, args.report || 'tmp/llm_quality_report.json');
  const gatePath = path.resolve(root, args.gate || 'tmp/llm_quality_gate_result.json');
  const outputPath = path.resolve(root, args.output || 'tmp/llm_quality_audit.json');

  const summaryPayload = readJson(summaryPath);
  const summary = normalizeSummary(summaryPayload);
  const report = readJson(reportPath);
  const gate = readJson(gatePath);
  const qualityFramework = summary && summary.qualityFramework && typeof summary.qualityFramework === 'object'
    ? summary.qualityFramework
    : {};
  const qualityLoopV2 = qualityFramework.qualityLoopV2 && typeof qualityFramework.qualityLoopV2 === 'object'
    ? qualityFramework.qualityLoopV2
    : {};
  const criticalSlices = Array.isArray(qualityLoopV2.criticalSlices) ? qualityLoopV2.criticalSlices : [];
  const integrationKpis = qualityLoopV2.integrationKpis && typeof qualityLoopV2.integrationKpis === 'object'
    ? qualityLoopV2.integrationKpis
    : {};
  const missingMeasurements = Object.entries(integrationKpis)
    .filter(([, value]) => value && typeof value === 'object' && value.status === 'missing')
    .map(([key]) => key);

  const payload = {
    auditVersion: 'v2',
    generatedAt: new Date().toISOString(),
    source: {
      summaryPath,
      reportPath,
      gatePath
    },
    overallScore: Number(qualityFramework.overallScore || report.overall_quality_score || 0),
    hardGatePass: qualityFramework.hardGate && qualityFramework.hardGate.pass === true,
    hardGateFailures: uniqueList([
      ...(qualityFramework.hardGate && Array.isArray(qualityFramework.hardGate.failures) ? qualityFramework.hardGate.failures : []),
      ...(Array.isArray(report.hard_gate_failures) ? report.hard_gate_failures : []),
      ...(gate && gate.gate && Array.isArray(gate.gate.failures) ? gate.gate.failures : [])
    ]),
    criticalSliceFailures: criticalSlices.filter((row) => row && row.status === 'fail'),
    integrationKpis,
    missingMeasurements,
    releaseReady: summary.releaseReadiness && summary.releaseReadiness.ready === true,
    topQualityFailures: Array.isArray(report.top_10_quality_failures) ? report.top_10_quality_failures : [],
    topLoopCases: Array.isArray(report.top_10_loop_cases) ? report.top_10_loop_cases : [],
    topContextLossCases: Array.isArray(report.top_10_context_loss_cases) ? report.top_10_context_loss_cases : [],
    counterexampleQueueOpenCount: Number(qualityFramework.counterexampleQueueOpenCount || 0),
    nextAuditFocus: deriveNextAuditFocus(report, {
      missingMeasurements
    })
  };

  writeJson(outputPath, payload);
  process.stdout.write(`${JSON.stringify({ ok: true, outputPath, overallScore: payload.overallScore }, null, 2)}\n`);
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  deriveNextAuditFocus,
  main
};
