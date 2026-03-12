'use strict';

const path = require('node:path');
const { parseArgs, readJson, writeJson } = require('./llm_quality/lib');

const CATEGORY_PRIORITY = Object.freeze({
  high: 3,
  medium: 2,
  low: 1
});

const CATEGORY_MAP = Object.freeze({
  knowledge: {
    signals: ['officialSourceUsageRate', 'cityPackGroundingRate', 'savedFaqReusePassRate', 'staleSourceBlockRate'],
    repoDimensions: ['knowledgeIntegration'],
    candidateFiles: [
      'src/domain/llm/knowledge/computeSourceReadiness.js',
      'src/usecases/cityPack/validateCityPackSources.js',
      'src/usecases/faq/answerFaqFromKb.js'
    ],
    suggestedTests: [
      'tests/phase804/*.test.js',
      'tests/phase810/*.test.js',
      'tests/phase813/*.test.js'
    ]
  },
  router: {
    signals: ['compatShareWindow'],
    repoDimensions: ['routerCoverage'],
    candidateFiles: [
      'src/routes/webhookLine.js',
      'src/domain/llm/quality/resolveSharedAnswerReadiness.js'
    ],
    suggestedTests: [
      'tests/phase731/*.test.js',
      'tests/phase805/*.test.js'
    ]
  },
  policy: {
    signals: ['officialSourceUsageRate', 'compatShareWindow'],
    repoDimensions: ['readinessIntegration'],
    candidateFiles: [
      'src/domain/llm/policy/resolveLlmLegalPolicySnapshot.js',
      'src/domain/llm/policy/resolveIntentRiskTier.js'
    ],
    suggestedTests: [
      'tests/phase801/*.test.js',
      'tests/phase803/*.test.js'
    ]
  },
  readiness: {
    signals: ['contradictionRate', 'unsupportedClaimRate', 'evidenceCoverage', 'clarifyRateByTier', 'fallbackRateByCause'],
    repoDimensions: ['readinessIntegration'],
    candidateFiles: [
      'src/domain/llm/quality/evaluateAnswerReadiness.js',
      'src/domain/llm/quality/runAnswerReadinessGateV2.js',
      'src/domain/llm/orchestrator/verifyCandidate.js'
    ],
    suggestedTests: [
      'tests/phase805/*.test.js',
      'tests/phase815/*.test.js',
      'tests/phase816/*.test.js'
    ]
  },
  integration: {
    signals: ['cityPackGroundingRate', 'emergencyOfficialSourceRate', 'journeyAlignedActionRate', 'savedFaqReusePassRate'],
    repoDimensions: ['knowledgeIntegration', 'traceJoinCoverage'],
    candidateFiles: [
      'src/routes/webhookLine.js',
      'src/usecases/admin/getTraceBundle.js',
      'src/usecases/emergency/adminEmergencyLayer.js',
      'src/routes/admin/journeyGraphRuntime.js'
    ],
    suggestedTests: [
      'tests/phase810/*.test.js',
      'tests/phase811/*.test.js',
      'tests/phase812/*.test.js',
      'tests/phase814/*.test.js'
    ]
  },
  telemetry: {
    signals: ['traceJoinCompleteness', 'adminTraceResolutionTime'],
    repoDimensions: ['telemetryCoverage', 'traceJoinCoverage'],
    candidateFiles: [
      'src/routes/admin/osLlmUsageSummary.js',
      'src/usecases/admin/getTraceBundle.js',
      'src/repos/firestore/llmActionLogsRepo.js'
    ],
    suggestedTests: [
      'tests/phase807/*.test.js',
      'tests/phase809/*.test.js',
      'tests/phase814/*.test.js'
    ]
  }
});

function toRelative(rootDir, maybePath) {
  if (typeof maybePath !== 'string' || !maybePath.startsWith('file:')) return maybePath;
  const parts = maybePath.split(':');
  const absPath = parts[1] || '';
  const line = parts[2] || '';
  return `file:${path.relative(rootDir, absPath)}:${line}`;
}

function resolveSeverity(signals) {
  const rows = Array.isArray(signals) ? signals : [];
  if (rows.some((row) => row && (row.status === 'fail' || row.status === 'missing'))) return 'high';
  if (rows.some((row) => row && row.status === 'warning')) return 'medium';
  return 'low';
}

function uniqueSorted(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'ja'));
}

function buildFailureClusters(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const rootDir = payload.rootDir ? path.resolve(payload.rootDir) : process.cwd();
  const audit = payload.audit && typeof payload.audit === 'object' ? payload.audit : {};
  const scan = payload.scan && typeof payload.scan === 'object' ? payload.scan : {};
  const kpis = audit.kpis && typeof audit.kpis === 'object' ? audit.kpis : {};
  const dimensions = scan.dimensions && typeof scan.dimensions === 'object' ? scan.dimensions : {};
  const clusters = [];

  Object.entries(CATEGORY_MAP).forEach(([category, config], index) => {
    const signalRows = [];
    (config.signals || []).forEach((signal) => {
      if (Object.prototype.hasOwnProperty.call(kpis, signal)) {
        const row = kpis[signal];
        if (row && row.status && row.status !== 'pass') {
          signalRows.push({ signal, status: row.status, sampleCount: Number(row.sampleCount || 0) });
        }
      }
    });

    const dimensionEvidence = [];
    (config.repoDimensions || []).forEach((dimension) => {
      const row = dimensions[dimension];
      if (!row) return;
      if (row.status !== 'present') {
        signalRows.push({ signal: dimension, status: row.status === 'missing' ? 'missing' : 'warning', sampleCount: 0 });
      }
      (Array.isArray(row.evidence) ? row.evidence : []).forEach((entry) => dimensionEvidence.push(toRelative(rootDir, entry)));
      (Array.isArray(row.gaps) ? row.gaps : []).forEach((gap) => dimensionEvidence.push(`gap:${gap}`));
    });

    if (signalRows.length === 0) return;

    const severity = resolveSeverity(signalRows);
    clusters.push({
      clusterId: `${category}-${String(index + 1).padStart(2, '0')}`,
      category,
      severity,
      signals: signalRows,
      evidence: uniqueSorted(dimensionEvidence),
      candidateFiles: uniqueSorted(config.candidateFiles || []),
      suggestedTests: uniqueSorted(config.suggestedTests || [])
    });
  });

  clusters.sort((left, right) => {
    const severityDelta = (CATEGORY_PRIORITY[right.severity] || 0) - (CATEGORY_PRIORITY[left.severity] || 0);
    if (severityDelta !== 0) return severityDelta;
    return left.category.localeCompare(right.category, 'ja');
  });

  return {
    clusterVersion: 'v3',
    generatedAt: new Date().toISOString(),
    clusters
  };
}

function main(argv) {
  const args = parseArgs(argv);
  const repoScanPath = path.resolve(process.cwd(), args.scan || path.join('tmp', 'repo_scan_report.json'));
  const auditPath = path.resolve(process.cwd(), args.audit || path.join('tmp', 'quality_audit_report.json'));
  const outputPath = path.resolve(process.cwd(), args.output || path.join('tmp', 'failure_clusters.json'));
  const report = buildFailureClusters({
    rootDir: process.cwd(),
    audit: readJson(auditPath),
    scan: readJson(repoScanPath)
  });
  writeJson(outputPath, report);
  process.stdout.write(`${JSON.stringify({ ok: true, outputPath, clusterCount: report.clusters.length }, null, 2)}\n`);
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  CATEGORY_MAP,
  buildFailureClusters,
  main
};
