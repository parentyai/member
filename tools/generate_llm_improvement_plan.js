'use strict';

const path = require('node:path');
const { parseArgs, readJson, writeJson } = require('./llm_quality/lib');

const BACKLOG_BY_SIGNAL = Object.freeze({
  cityPackGroundingRate: { pr: 'PR-8', title: 'City Pack / Source Refs Integration Hardening' },
  staleSourceBlockRate: { pr: 'PR-8', title: 'City Pack / Source Refs Integration Hardening' },
  emergencyOfficialSourceRate: { pr: 'PR-9', title: 'Emergency Layer Quality Override' },
  emergencyOverrideAppliedRate: { pr: 'PR-9', title: 'Emergency Layer Quality Override' },
  journeyAlignedActionRate: { pr: 'PR-10', title: 'Journey / Task / Blocker Grounding' },
  taskBlockerConflictRate: { pr: 'PR-10', title: 'Journey / Task / Blocker Grounding' },
  savedFaqReusePassRate: { pr: 'PR-11', title: 'Saved FAQ / KB Governance' },
  crossSystemConflictRate: { pr: 'PR-12', title: 'Cross-System Trace Join & Operator UX' },
  traceJoinCompleteness: { pr: 'PR-12', title: 'Cross-System Trace Join & Operator UX' },
  adminTraceResolutionTime: { pr: 'PR-12', title: 'Cross-System Trace Join & Operator UX' }
});

function buildPlan(audit, integration) {
  const rows = [];
  const missing = Array.isArray(integration.missingMeasurements) ? integration.missingMeasurements : [];
  missing.forEach((key) => {
    const target = BACKLOG_BY_SIGNAL[key];
    if (!target) return;
    rows.push({
      priority: 'high',
      signal: key,
      pr: target.pr,
      title: target.title,
      reason: 'measurement_missing'
    });
  });
  const criticalFailures = Array.isArray(audit.criticalSliceFailures) ? audit.criticalSliceFailures : [];
  criticalFailures.forEach((row) => {
    const signal = row && typeof row.sliceKey === 'string' ? row.sliceKey : 'critical_slice';
    rows.push({
      priority: 'high',
      signal,
      pr: 'PR-followup',
      title: 'Critical slice remediation',
      reason: 'critical_slice_fail'
    });
  });
  return rows;
}

function main(argv) {
  const args = parseArgs(argv);
  const root = process.cwd();
  const auditPath = path.resolve(root, args.audit || 'tmp/llm_quality_audit.json');
  const integrationPath = path.resolve(root, args.integration || 'tmp/llm_integration_audit.json');
  const outputPath = path.resolve(root, args.output || 'tmp/llm_quality_improvement_plan.json');
  const audit = readJson(auditPath);
  const integration = readJson(integrationPath);
  const backlog = buildPlan(audit, integration);
  const payload = {
    planVersion: 'v2',
    generatedAt: new Date().toISOString(),
    source: {
      auditPath,
      integrationPath
    },
    backlog
  };
  writeJson(outputPath, payload);
  process.stdout.write(`${JSON.stringify({ ok: true, outputPath, backlogCount: backlog.length }, null, 2)}\n`);
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  buildPlan,
  main
};
