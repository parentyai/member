'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseArgs, writeJson } = require('./llm_quality/lib');

const ROOT = path.resolve(__dirname, '..');

const FILES = Object.freeze({
  webhookLine: path.join(ROOT, 'src/routes/webhookLine.js'),
  readiness: path.join(ROOT, 'src/domain/llm/quality/evaluateAnswerReadiness.js'),
  sharedReadiness: path.join(ROOT, 'src/domain/llm/quality/resolveSharedAnswerReadiness.js'),
  sourceReadiness: path.join(ROOT, 'src/domain/llm/knowledge/computeSourceReadiness.js'),
  traceBundle: path.join(ROOT, 'src/usecases/admin/getTraceBundle.js'),
  usageSummary: path.join(ROOT, 'src/routes/admin/osLlmUsageSummary.js')
});

const DIMENSION_ANCHORS = Object.freeze({
  routerCoverage: [
    { gap: 'missing_webhook_conversation_entry', fileKey: 'webhookLine', pattern: /handleAssistantMessage/ },
    { gap: 'missing_paid_orchestrator_path', fileKey: 'webhookLine', pattern: /runPaidConversationOrchestrator/ },
    { gap: 'missing_shared_readiness_bridge', fileKey: 'webhookLine', pattern: /resolveSharedAnswerReadiness/ }
  ],
  readinessIntegration: [
    { gap: 'missing_readiness_evaluator', fileKey: 'readiness', pattern: /function evaluateAnswerReadiness/ },
    { gap: 'missing_shared_readiness_wrapper', fileKey: 'sharedReadiness', pattern: /function resolveSharedAnswerReadiness/ },
    { gap: 'missing_readiness_v2_stage', fileKey: 'readiness', pattern: /answerReadinessV2Stage/ }
  ],
  knowledgeIntegration: [
    { gap: 'missing_source_readiness_core', fileKey: 'sourceReadiness', pattern: /function computeSourceReadiness/ },
    { gap: 'missing_city_pack_grounding_signal', fileKey: 'usageSummary', pattern: /cityPackGroundingRate/ },
    { gap: 'missing_saved_faq_governance_signal', fileKey: 'usageSummary', pattern: /savedFaqReusePassRate/ }
  ],
  telemetryCoverage: [
    { gap: 'missing_usage_summary_quality_loop_v2', fileKey: 'usageSummary', pattern: /qualityLoopV2/ },
    { gap: 'missing_trace_join_signal', fileKey: 'usageSummary', pattern: /traceJoinCompleteness/ },
    { gap: 'missing_runtime_audit_signal', fileKey: 'usageSummary', pattern: /qualityLoopV2CriticalSliceFailCount/ }
  ],
  traceJoinCoverage: [
    { gap: 'missing_trace_bundle_builder', fileKey: 'traceBundle', pattern: /function getTraceBundle/ },
    { gap: 'missing_trace_bundle_decisions_join', fileKey: 'traceBundle', pattern: /decisions/ },
    { gap: 'missing_trace_bundle_timeline_join', fileKey: 'traceBundle', pattern: /timeline/ }
  ]
});

function readFileLines(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8').split('\n');
  } catch (_err) {
    return [];
  }
}

function resolveEvidence(filePath, pattern) {
  const lines = readFileLines(filePath);
  for (let index = 0; index < lines.length; index += 1) {
    if (pattern.test(lines[index])) {
      return `file:${filePath}:${index + 1}`;
    }
  }
  return null;
}

function resolveBaselineRef(rootDir) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: rootDir, encoding: 'utf8' }).trim();
  } catch (_err) {
    return 'unknown';
  }
}

function summarizeDimensions(dimensions) {
  const rows = Object.values(dimensions);
  const coverageScore = rows.length > 0
    ? Math.round((rows.reduce((sum, row) => sum + Number(row.coverageScore || 0), 0) / rows.length) * 10000) / 10000
    : 0;
  const statusCounts = rows.reduce((acc, row) => {
    const key = typeof row.status === 'string' ? row.status : 'missing';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return {
    coverageScore,
    statusCounts,
    dimensionCount: rows.length
  };
}

function buildRepoScanReport(options) {
  const payload = options && typeof options === 'object' ? options : {};
  const rootDir = payload.rootDir ? path.resolve(payload.rootDir) : ROOT;
  const dimensions = {};
  const topGapCounts = new Map();

  Object.entries(DIMENSION_ANCHORS).forEach(([dimension, anchors]) => {
    const evidence = [];
    const gaps = [];
    let foundCount = 0;

    anchors.forEach((anchor) => {
      const filePath = FILES[anchor.fileKey];
      const match = resolveEvidence(filePath, anchor.pattern);
      if (match) {
        evidence.push(match);
        foundCount += 1;
      } else {
        gaps.push(anchor.gap);
        topGapCounts.set(anchor.gap, (topGapCounts.get(anchor.gap) || 0) + 1);
      }
    });

    const coverageScore = anchors.length > 0
      ? Math.round((foundCount / anchors.length) * 10000) / 10000
      : 0;
    const status = foundCount === 0 ? 'missing' : (foundCount === anchors.length ? 'present' : 'partial');

    dimensions[dimension] = {
      status,
      evidence,
      gaps,
      coverageScore
    };
  });

  const topGaps = Array.from(topGapCounts.entries())
    .map(([gap, count]) => ({ gap, count }))
    .sort((left, right) => right.count - left.count || left.gap.localeCompare(right.gap, 'ja'))
    .slice(0, 10);

  return {
    scanVersion: 'v3',
    generatedAt: new Date().toISOString(),
    baselineRef: payload.baselineRef || resolveBaselineRef(rootDir),
    dimensions,
    topGaps,
    summary: summarizeDimensions(dimensions)
  };
}

function main(argv) {
  const args = parseArgs(argv);
  const outputPath = path.resolve(process.cwd(), args.output || path.join('tmp', 'repo_scan_report.json'));
  const report = buildRepoScanReport({
    rootDir: process.cwd()
  });
  writeJson(outputPath, report);
  process.stdout.write(`${JSON.stringify({ ok: true, outputPath, topGapCount: report.topGaps.length }, null, 2)}\n`);
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  FILES,
  DIMENSION_ANCHORS,
  buildRepoScanReport,
  main
};
