'use strict';

const path = require('node:path');
const { parseArgs, readJson, writeJson } = require('./llm_quality/lib');

const BACKLOG_BY_SIGNAL = Object.freeze({
  runtimeAuditUnavailable: { pr: 'PR-telemetry-live-audit-restoration', title: 'Live telemetry audit restoration' },
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

const BACKLOG_BY_CLUSTER = Object.freeze({
  knowledge: {
    PR: 'PR-knowledge-hardening',
    objective: 'Strengthen source readiness, City Pack grounding, and saved FAQ governance.',
    files: [
      'src/domain/llm/knowledge/computeSourceReadiness.js',
      'src/usecases/cityPack/validateCityPackSources.js',
      'src/usecases/faq/answerFaqFromKb.js'
    ],
    tests: [
      'tests/phase804/*.test.js',
      'tests/phase810/*.test.js',
      'tests/phase813/*.test.js'
    ],
    risk: 'Higher refuse or clarify rates if source metadata is sparse.',
    rollback: 'Disable source readiness enforcement flags and revert the knowledge hardening PR.'
  },
  router: {
    PR: 'PR-router-coverage',
    objective: 'Improve route coverage and reduce compat-driven routing gaps.',
    files: [
      'src/routes/webhookLine.js',
      'src/domain/llm/quality/resolveSharedAnswerReadiness.js'
    ],
    tests: [
      'tests/phase731/*.test.js',
      'tests/phase805/*.test.js'
    ],
    risk: 'Incorrect router changes can increase default fallback or compat load.',
    rollback: 'Revert router coverage PR and keep v2 readiness in log-only mode.'
  },
  policy: {
    PR: 'PR-policy-tightening',
    objective: 'Tighten legal, high-risk, and official-source policy enforcement.',
    files: [
      'src/domain/llm/policy/resolveLlmLegalPolicySnapshot.js',
      'src/domain/llm/policy/resolveIntentRiskTier.js'
    ],
    tests: [
      'tests/phase801/*.test.js',
      'tests/phase803/*.test.js'
    ],
    risk: 'Policy hardening can increase false-positive blocking if thresholds are too strict.',
    rollback: 'Disable policy enforcement flags and revert the policy PR.'
  },
  readiness: {
    PR: 'PR-readiness-hardening',
    objective: 'Reduce unsupported claims, contradiction escapes, and over-clarification in final response decisions.',
    files: [
      'src/domain/llm/quality/evaluateAnswerReadiness.js',
      'src/domain/llm/quality/runAnswerReadinessGateV2.js',
      'src/domain/llm/orchestrator/verifyCandidate.js'
    ],
    tests: [
      'tests/phase805/*.test.js',
      'tests/phase815/*.test.js',
      'tests/phase816/*.test.js'
    ],
    risk: 'Readiness tuning can shift clarify/refuse rates if applied too broadly.',
    rollback: 'Turn off readiness v2 enforcement and revert the readiness PR.'
  },
  integration: {
    PR: 'PR-integration-governance',
    objective: 'Fix cross-system conflicts across City Pack, Emergency, Journey, FAQ, and trace-integrated runtime signals.',
    files: [
      'src/routes/webhookLine.js',
      'src/usecases/admin/getTraceBundle.js',
      'src/usecases/emergency/adminEmergencyLayer.js',
      'src/routes/admin/journeyGraphRuntime.js'
    ],
    tests: [
      'tests/phase810/*.test.js',
      'tests/phase811/*.test.js',
      'tests/phase812/*.test.js',
      'tests/phase814/*.test.js'
    ],
    risk: 'Cross-system joins can add latency or expose stale upstream state.',
    rollback: 'Disable integration feature flags and revert the integration PR.'
  },
  telemetry: {
    PR: 'PR-telemetry-live-audit-restoration',
    objective: 'Restore live runtime audit access, surface auth recovery guidance, and close logging/trace visibility gaps.',
    files: [
      'tools/run_llm_runtime_audit.js',
      'tools/run_llm_improvement_loop.js',
      'tools/llm_quality/run_quality_gate.js',
      'tools/llm_quality/enforce_release_policy.js',
      'src/routes/admin/osLlmUsageSummary.js',
      'src/usecases/admin/getTraceBundle.js',
      'docs/LLM_RUNBOOK.md'
    ],
    tests: [
      'tests/phase821/*.test.js',
      'tests/phase824/*.test.js',
      'tests/phase825/*.test.js',
      'tests/phase807/*.test.js',
      'tests/phase809/*.test.js',
      'tests/phase814/*.test.js'
    ],
    risk: 'Auth-path changes can hide real runtime failures if degraded and live modes are not kept distinct.',
    rollback: 'Keep degraded mode active, disable live-runtime requirements, and revert the telemetry restoration PR.'
  }
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

function buildBacklogRowsFromSignals(signalEntries, options) {
  const payload = options && typeof options === 'object' ? options : {};
  const rows = [];
  const seen = new Set();

  const telemetryRestorationEntry = (Array.isArray(signalEntries) ? signalEntries : []).find((entry) => (
    entry
    && entry.category === 'telemetry'
    && Array.isArray(entry.signals)
    && entry.signals.some((row) => row && row.signal === 'runtimeAuditUnavailable')
  ));
  if (telemetryRestorationEntry) {
    const mapping = BACKLOG_BY_CLUSTER.telemetry;
    seen.add('telemetry');
    rows.push({
      priority: telemetryRestorationEntry && typeof telemetryRestorationEntry.severity === 'string'
        ? telemetryRestorationEntry.severity
        : 'high',
      category: 'telemetry',
      signals: ['runtimeAuditUnavailable'],
      PR: mapping.PR,
      objective: mapping.objective,
      files: mapping.files.slice(),
      tests: mapping.tests.slice(),
      risk: mapping.risk,
      rollback: mapping.rollback
    });
  }

  (Array.isArray(signalEntries) ? signalEntries : []).forEach((entry) => {
    const category = entry && typeof entry.category === 'string' ? entry.category.trim() : '';
    const mapping = BACKLOG_BY_CLUSTER[category];
    if (!mapping) return;
    if (seen.has(category)) return;
    seen.add(category);
    rows.push({
      priority: entry && typeof entry.severity === 'string' ? entry.severity : 'medium',
      category,
      signals: Array.isArray(entry && entry.signals)
        ? entry.signals.map((row) => row && row.signal).filter(Boolean)
        : [],
      PR: mapping.PR,
      objective: mapping.objective,
      files: mapping.files.slice(),
      tests: mapping.tests.slice(),
      risk: mapping.risk,
      rollback: mapping.rollback
    });
  });

  return rows.slice(0, Number.isFinite(Number(payload.limit)) ? Math.max(1, Math.floor(Number(payload.limit))) : rows.length);
}

function buildPlanFromClusters(clusterPayload, options) {
  const payload = clusterPayload && typeof clusterPayload === 'object' ? clusterPayload : {};
  const clusters = Array.isArray(payload.clusters) ? payload.clusters : [];
  const source = options && typeof options === 'object' ? options : {};
  return {
    planVersion: 'v3',
    generatedAt: new Date().toISOString(),
    source: {
      clustersPath: source.clustersPath || null
    },
    backlog: buildBacklogRowsFromSignals(clusters, { limit: 10 })
  };
}

function main(argv) {
  const args = parseArgs(argv);
  const root = process.cwd();
  const outputPath = path.resolve(root, args.output || (args.clusters ? 'tmp/improvement_plan.json' : 'tmp/llm_quality_improvement_plan.json'));
  let payload;
  if (args.clusters) {
    const clustersPath = path.resolve(root, args.clusters || 'tmp/failure_clusters.json');
    const clusters = readJson(clustersPath);
    payload = buildPlanFromClusters(clusters, { clustersPath });
  } else {
    const auditPath = path.resolve(root, args.audit || 'tmp/llm_quality_audit.json');
    const integrationPath = path.resolve(root, args.integration || 'tmp/llm_integration_audit.json');
    const audit = readJson(auditPath);
    const integration = readJson(integrationPath);
    const backlog = buildPlan(audit, integration);
    payload = {
      planVersion: 'v2',
      generatedAt: new Date().toISOString(),
      source: {
        auditPath,
        integrationPath
      },
      backlog
    };
  }
  writeJson(outputPath, payload);
  process.stdout.write(`${JSON.stringify({ ok: true, outputPath, backlogCount: Array.isArray(payload.backlog) ? payload.backlog.length : 0 }, null, 2)}\n`);
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  buildPlan,
  buildBacklogRowsFromSignals,
  buildPlanFromClusters,
  main
};
