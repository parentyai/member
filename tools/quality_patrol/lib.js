'use strict';

const os = require('node:os');
const path = require('node:path');
const { parseArgs, writeJson } = require('../llm_quality/lib');
const { buildConversationReviewUnitsFromSources } = require('../../src/usecases/qualityPatrol/buildConversationReviewUnitsFromSources');
const { evaluateConversationReviewUnits } = require('../../src/usecases/qualityPatrol/evaluateConversationReviewUnits');
const { buildPatrolKpisFromEvaluations } = require('../../src/usecases/qualityPatrol/buildPatrolKpisFromEvaluations');
const { detectIssues } = require('../../src/domain/qualityPatrol/detectIssues');
const { analyzeQualityIssues } = require('../../src/usecases/qualityPatrol/analyzeQualityIssues');
const { planQualityImprovements } = require('../../src/usecases/qualityPatrol/planQualityImprovements');
const { queryLatestPatrolInsights } = require('../../src/usecases/qualityPatrol/queryLatestPatrolInsights');
const { detectAndUpsertQualityIssues } = require('../../src/usecases/qualityPatrol/detectAndUpsertQualityIssues');
const { listOpenIssues } = require('../../src/usecases/qualityPatrol/listOpenIssues');
const { listTopPriorityBacklog } = require('../../src/usecases/qualityPatrol/listTopPriorityBacklog');
const { buildPatrolQueryResponse } = require('../../src/domain/qualityPatrol/query/buildPatrolQueryResponse');
const {
  buildPatrolBacklogSeparation,
  createEmptyPatrolBacklogSeparation
} = require('../../src/domain/qualityPatrol/query/buildPatrolBacklogSeparation');
const {
  buildHumanSafePatrolSurface
} = require('../../src/domain/qualityPatrol/query/buildHumanSafePatrolSurface');
const { createEmptyDecayAwareReadiness } = require('../../src/domain/qualityPatrol/buildDecayAwareReadiness');
const { createEmptyDecayAwareOpsGate } = require('../../src/domain/qualityPatrol/buildDecayAwareOpsGate');

const MAIN_ARTIFACT_VERSION = 'quality_patrol_job_v1';
const METRICS_ARTIFACT_VERSION = 'quality_patrol_metrics_job_v1';
const DETECTION_ARTIFACT_VERSION = 'quality_patrol_detection_job_v1';
const PLANNING_ARTIFACT_VERSION = 'quality_patrol_planning_job_v1';
const JOB_PROVENANCE = 'quality_patrol_job';
const SUPPORTED_MODES = new Set([
  'latest',
  'top-risk',
  'newly-detected-improvements',
  'observation-blockers',
  'next-best-pr'
]);
const SUPPORTED_AUDIENCES = new Set(['operator', 'human']);

function normalizeError(error) {
  if (!error || typeof error !== 'object') {
    return {
      code: 'unknown_error',
      message: error ? String(error) : 'unknown quality patrol job error'
    };
  }
  const message = typeof error.message === 'string' && error.message.trim()
    ? error.message.trim()
    : 'unknown quality patrol job error';
  const code = typeof error.code === 'string' && error.code.trim()
    ? error.code.trim()
    : 'unknown_error';
  return { code, message };
}

function normalizePositiveInt(value, fallback, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(numeric)));
}

function normalizeMode(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return SUPPORTED_MODES.has(normalized) ? normalized : 'latest';
}

function normalizeAudience(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return SUPPORTED_AUDIENCES.has(normalized) ? normalized : 'operator';
}

function normalizeBoolean(value) {
  return value === true || value === 'true' || value === '1';
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())))
    .sort((left, right) => left.localeCompare(right, 'ja'));
}

function defaultOutputPath(filename) {
  return path.join(os.tmpdir(), filename);
}

function resolveOutputPath(value, fallbackFilename) {
  if (typeof value === 'string' && value.trim()) return path.resolve(process.cwd(), value.trim());
  return defaultOutputPath(fallbackFilename);
}

function parsePatrolArgs(argv) {
  const args = parseArgs(argv);
  const mode = normalizeMode(args.mode);
  const limit = normalizePositiveInt(args.limit, 100, 500);
  return {
    mode,
    audience: normalizeAudience(args.audience),
    fromAt: typeof args.fromAt === 'string' ? args.fromAt : null,
    toAt: typeof args.toAt === 'string' ? args.toAt : null,
    limit,
    traceLimit: normalizePositiveInt(args.traceLimit, Math.min(limit, 200), 200),
    registryLimit: normalizePositiveInt(args.registryLimit, 100, 200),
    backlogLimit: normalizePositiveInt(args.backlogLimit, 50, 100),
    threadId: typeof args.threadId === 'string' && args.threadId.trim() ? args.threadId.trim() : `quality_patrol_job_${mode}`,
    writeIssues: normalizeBoolean(args['write-issues']),
    writeBacklog: normalizeBoolean(args['write-backlog']),
    output: resolveOutputPath(args.output, `quality_patrol_${mode.replace(/[^a-z0-9]+/g, '_')}.json`),
    metricsOutput: args['metrics-output'] ? resolveOutputPath(args['metrics-output'], 'quality_patrol_metrics.json') : null,
    detectionOutput: args['detection-output'] ? resolveOutputPath(args['detection-output'], 'quality_patrol_detection.json') : null,
    planningOutput: args['planning-output'] ? resolveOutputPath(args['planning-output'], 'quality_patrol_planning.json') : null
  };
}

function createSourceWindow(payload) {
  return {
    fromAt: payload && payload.fromAt ? payload.fromAt : null,
    toAt: payload && payload.toAt ? payload.toAt : null
  };
}

function createEmptyExtractorResult(payload) {
  return {
    ok: false,
    sourceWindow: createSourceWindow(payload),
    reviewUnits: [],
    llmActionLogs: [],
    sourceCollections: [],
    counts: {
      snapshots: 0,
      llmActionLogs: 0,
      faqAnswerLogs: 0,
      traceBundles: 0
    }
  };
}

function createEmptyEvaluationResult(payload) {
  return {
    ok: false,
    sourceWindow: createSourceWindow(payload),
    evaluations: [],
    counts: {
      reviewUnits: 0,
      blocked: 0,
      fail: 0,
      warn: 0
    },
    sourceCollections: []
  };
}

function createEmptyKpiResult() {
  return {
    ok: false,
    summary: {
      overallStatus: 'unavailable',
      reviewUnitCount: 0,
      sliceCounts: {}
    },
    metrics: {},
    issueCandidateMetrics: {},
    transcriptCoverage: {
      observedCount: 0,
      writtenCount: 0,
      skippedCount: 0,
      failedCount: 0,
      transcriptWriteOutcomeCounts: {
        written: 0,
        skipped_flag_disabled: 0,
        skipped_missing_line_user_key: 0,
        skipped_unreviewable_transcript: 0,
        failed_repo_write: 0,
        failed_unknown: 0
      },
      transcriptWriteFailureReasons: {},
      snapshotInputDiagnostics: {
        assistantReplyPresent: {
          trueCount: 0,
          falseCount: 0
        },
        assistantReplyLength: {
          observedCount: 0,
          min: null,
          max: null,
          avg: 0
        },
        sanitizedReplyLength: {
          observedCount: 0,
          min: null,
          max: null,
          avg: 0
        },
        snapshotBuildAttempted: {
          trueCount: 0,
          falseCount: 0
        },
        snapshotBuildSkippedReason: {
          feature_flag_off: 0,
          line_user_key_missing: 0,
          assistant_reply_missing: 0,
          sanitized_reply_empty: 0,
          masking_removed_text: 0,
          region_prompt_fallback: 0
        }
      },
      transcriptCoverageStatus: 'unavailable',
      sourceCollections: ['llm_action_logs']
    },
    decayAwareReadiness: createEmptyDecayAwareReadiness(),
    decayAwareOpsGate: createEmptyDecayAwareOpsGate(),
    backlogSeparation: createEmptyPatrolBacklogSeparation('operator'),
    observationBlockers: [],
    provenance: 'review_unit_evaluator',
    sourceCollections: []
  };
}

function createEmptyDetectionResult() {
  return {
    summary: {
      issueCount: 0,
      blockedCount: 0,
      openCount: 0,
      watchingCount: 0,
      byType: {},
      bySlice: {}
    },
    issueCandidates: [],
    backlogCandidates: [],
    provenance: 'quality_patrol_detection',
    sourceCollections: []
  };
}

function createEmptyRootCauseResult() {
  return {
    summary: {
      reportCount: 0,
      analyzedCount: 0,
      blockedCount: 0,
      insufficientEvidenceCount: 0,
      byAnalysisStatus: {},
      byCauseType: {}
    },
    rootCauseReports: [],
    provenance: 'quality_patrol_root_cause_analysis',
    sourceCollections: []
  };
}

function createEmptyPlanResult(generatedAt) {
  return {
    planVersion: 'quality_patrol_improvement_plan_v1',
    generatedAt: generatedAt || new Date().toISOString(),
    summary: {
      topPriorityCount: 0,
      observationOnlyCount: 0,
      runtimeFixCount: 0
    },
    recommendedPr: [],
    observationBlockers: [],
    planningStatus: 'insufficient_evidence',
    provenance: 'quality_patrol_improvement_planner',
    sourceCollections: []
  };
}

async function runStage(stageKey, executor, fallbackBuilder) {
  try {
    const result = await executor();
    return {
      status: 'ok',
      error: null,
      result
    };
  } catch (error) {
    return {
      status: 'unavailable',
      error: normalizeError(error),
      result: typeof fallbackBuilder === 'function' ? fallbackBuilder() : fallbackBuilder
    };
  }
}

function summarizeAnalysisStatus(rootCauseResult) {
  if (rootCauseResult && rootCauseResult.summary && rootCauseResult.summary.blockedCount > 0) return 'blocked';
  if (rootCauseResult && rootCauseResult.summary && rootCauseResult.summary.analyzedCount > 0) return 'analyzed';
  return 'insufficient_evidence';
}

function buildFallbackQueryArtifact(payload) {
  return buildPatrolQueryResponse({
    generatedAt: payload.generatedAt,
    audience: payload.audience,
    mode: payload.mode,
    reviewUnits: payload.reviewUnits,
    evaluations: payload.evaluations,
    metrics: Object.assign({}, payload.kpiResult.metrics || {}, payload.kpiResult.issueCandidateMetrics || {}),
    transcriptCoverage: payload.kpiResult.transcriptCoverage || null,
    decayAwareReadiness: payload.kpiResult.decayAwareReadiness || null,
    decayAwareOpsGate: payload.kpiResult.decayAwareOpsGate || null,
    kpiSummary: payload.kpiResult.summary || null,
    issues: payload.detectionResult.issueCandidates || [],
    rootCauseReports: payload.rootCauseResult.rootCauseReports || [],
    recommendedPr: payload.planResult.recommendedPr || [],
    planObservationBlockers: payload.planResult.observationBlockers || [],
    planningStatus: payload.planResult.planningStatus || 'insufficient_evidence',
    joinDiagnostics: payload.joinDiagnostics || null,
    existingIssues: payload.existingIssues || [],
    existingBacklog: payload.existingBacklog || [],
    sourceCollections: payload.sourceCollections || []
  });
}

function buildMainArtifact(job) {
  const backlogSeparation = buildPatrolBacklogSeparation({
    audience: job.options.audience,
    decayAwareReadiness: job.kpiResult.decayAwareReadiness || createEmptyDecayAwareReadiness(),
    decayAwareOpsGate: job.kpiResult.decayAwareOpsGate || createEmptyDecayAwareOpsGate()
  });
  const humanSurface = job.options.audience === 'human'
    ? buildHumanSafePatrolSurface({
      transcriptCoverage: job.kpiResult.transcriptCoverage || createEmptyKpiResult().transcriptCoverage,
      decayAwareReadiness: job.kpiResult.decayAwareReadiness || createEmptyDecayAwareReadiness(),
      decayAwareOpsGate: job.kpiResult.decayAwareOpsGate || createEmptyDecayAwareOpsGate(),
      rootCauseResult: job.rootCauseResult,
      planResult: job.planResult,
      backlogSeparation
    })
    : null;
  return Object.assign({}, job.queryResult, {
    artifactVersion: MAIN_ARTIFACT_VERSION,
    mode: job.options.mode,
    planningStatus: job.planResult.planningStatus || 'insufficient_evidence',
    analysisStatus: summarizeAnalysisStatus(job.rootCauseResult),
    transcriptCoverage: humanSurface ? humanSurface.transcriptCoverage : (job.kpiResult.transcriptCoverage || createEmptyKpiResult().transcriptCoverage),
    decayAwareReadiness: humanSurface ? humanSurface.decayAwareReadiness : (job.kpiResult.decayAwareReadiness || createEmptyDecayAwareReadiness()),
    decayAwareOpsGate: humanSurface ? humanSurface.decayAwareOpsGate : (job.kpiResult.decayAwareOpsGate || createEmptyDecayAwareOpsGate()),
    backlogSeparation,
    provenance: JOB_PROVENANCE,
    sourceWindow: job.sourceWindow,
    runtimeFetchStatus: job.runtimeFetchStatus,
    writeStatus: job.writeStatus
  });
}

function buildMetricsArtifact(job) {
  const backlogSeparation = buildPatrolBacklogSeparation({
    audience: job.options.audience,
    decayAwareReadiness: job.kpiResult.decayAwareReadiness || createEmptyDecayAwareReadiness(),
    decayAwareOpsGate: job.kpiResult.decayAwareOpsGate || createEmptyDecayAwareOpsGate()
  });
  const humanSurface = job.options.audience === 'human'
    ? buildHumanSafePatrolSurface({
      transcriptCoverage: job.kpiResult.transcriptCoverage || createEmptyKpiResult().transcriptCoverage,
      decayAwareReadiness: job.kpiResult.decayAwareReadiness || createEmptyDecayAwareReadiness(),
      decayAwareOpsGate: job.kpiResult.decayAwareOpsGate || createEmptyDecayAwareOpsGate(),
      rootCauseResult: job.rootCauseResult,
      planResult: job.planResult,
      backlogSeparation
    })
    : null;
  return {
    artifactVersion: METRICS_ARTIFACT_VERSION,
    generatedAt: job.generatedAt,
    audience: job.options.audience,
    mode: job.options.mode,
    summary: job.kpiResult.summary || { overallStatus: 'unavailable', reviewUnitCount: 0, sliceCounts: {} },
    metrics: job.kpiResult.metrics || {},
    issueCandidateMetrics: job.kpiResult.issueCandidateMetrics || {},
    transcriptCoverage: humanSurface ? humanSurface.transcriptCoverage : (job.kpiResult.transcriptCoverage || createEmptyKpiResult().transcriptCoverage),
    decayAwareReadiness: humanSurface ? humanSurface.decayAwareReadiness : (job.kpiResult.decayAwareReadiness || createEmptyDecayAwareReadiness()),
    decayAwareOpsGate: humanSurface ? humanSurface.decayAwareOpsGate : (job.kpiResult.decayAwareOpsGate || createEmptyDecayAwareOpsGate()),
    backlogSeparation,
    observationBlockers: job.options.audience === 'human'
      ? (job.queryResult.observationBlockers || [])
      : (job.kpiResult.observationBlockers || []),
    provenance: 'quality_patrol_job_metrics',
    sourceCollections: job.kpiResult.sourceCollections || [],
    sourceWindow: job.sourceWindow,
    runtimeFetchStatus: job.runtimeFetchStatus
  };
}

function buildDetectionArtifact(job) {
  return {
    artifactVersion: DETECTION_ARTIFACT_VERSION,
    generatedAt: job.generatedAt,
    audience: job.options.audience,
    mode: job.options.mode,
    summary: job.detectionResult.summary || {
      issueCount: 0,
      blockedCount: 0,
      openCount: 0,
      watchingCount: 0,
      byType: {},
      bySlice: {}
    },
    issueCandidates: job.options.audience === 'human'
      ? (job.queryResult.issues || [])
      : (job.detectionResult.issueCandidates || []),
    backlogCandidates: job.options.audience === 'human'
      ? (job.queryResult.recommendedPr || [])
      : (job.detectionResult.backlogCandidates || []),
    observationBlockers: job.queryResult.observationBlockers || [],
    analysisStatus: summarizeAnalysisStatus(job.rootCauseResult),
    planningStatus: job.planResult.planningStatus || 'insufficient_evidence',
    provenance: 'quality_patrol_job_detection',
    sourceCollections: job.detectionResult.sourceCollections || [],
    sourceWindow: job.sourceWindow,
    runtimeFetchStatus: job.runtimeFetchStatus,
    writeStatus: job.writeStatus
  };
}

function buildPlanningArtifact(job) {
  const humanSurface = job.options.audience === 'human'
    ? buildHumanSafePatrolSurface({
      transcriptCoverage: null,
      decayAwareReadiness: null,
      decayAwareOpsGate: null,
      rootCauseResult: job.rootCauseResult,
      planResult: job.planResult
    })
    : null;
  return {
    artifactVersion: PLANNING_ARTIFACT_VERSION,
    generatedAt: job.generatedAt,
    audience: job.options.audience,
    mode: job.options.mode,
    summary: job.planResult.summary || {
      topPriorityCount: 0,
      observationOnlyCount: 0,
      runtimeFixCount: 0
    },
    recommendedPr: job.options.audience === 'human'
      ? (humanSurface.planResult.recommendedPr || [])
      : (job.planResult.recommendedPr || []),
    rootCauseReports: job.options.audience === 'human'
      ? (humanSurface.rootCauseResult.rootCauseReports || [])
      : (job.rootCauseResult.rootCauseReports || []),
    observationBlockers: job.queryResult.observationBlockers || [],
    planningStatus: job.planResult.planningStatus || 'insufficient_evidence',
    analysisStatus: summarizeAnalysisStatus(job.rootCauseResult),
    provenance: 'quality_patrol_job_planning',
    sourceCollections: uniqueStrings([].concat(job.rootCauseResult.sourceCollections || [], job.planResult.sourceCollections || [])),
    sourceWindow: job.sourceWindow,
    runtimeFetchStatus: job.runtimeFetchStatus
  };
}

async function runQualityPatrolPipeline(input, deps) {
  const payload = input && typeof input === 'object' ? input : {};
  const generatedAt = payload.generatedAt || new Date().toISOString();
  const options = Object.assign({}, payload, {
    mode: normalizeMode(payload.mode),
    audience: normalizeAudience(payload.audience)
  });
  const runtimeFetchStatus = {};

  const extractorStage = await runStage(
    'reviewUnits',
    () => (deps && deps.buildConversationReviewUnitsFromSources ? deps.buildConversationReviewUnitsFromSources : buildConversationReviewUnitsFromSources)(options, deps),
    () => createEmptyExtractorResult(options)
  );
  runtimeFetchStatus.reviewUnits = {
    status: extractorStage.status,
    count: Array.isArray(extractorStage.result.reviewUnits) ? extractorStage.result.reviewUnits.length : 0,
    joinDiagnostics: extractorStage.result && extractorStage.result.joinDiagnostics ? extractorStage.result.joinDiagnostics : null,
    error: extractorStage.error
  };
  const reviewUnits = Array.isArray(extractorStage.result.reviewUnits) ? extractorStage.result.reviewUnits : [];
  const llmActionLogs = Array.isArray(extractorStage.result.llmActionLogs) ? extractorStage.result.llmActionLogs : [];
  const traceBundles = extractorStage.result && extractorStage.result.traceBundles
    ? extractorStage.result.traceBundles
    : [];
  const sourceWindow = extractorStage.result.sourceWindow || createSourceWindow(options);

  const evaluationStage = await runStage(
    'evaluations',
    () => (deps && deps.evaluateConversationReviewUnits ? deps.evaluateConversationReviewUnits : evaluateConversationReviewUnits)(Object.assign({}, options, { reviewUnits }), deps),
    () => createEmptyEvaluationResult(options)
  );
  runtimeFetchStatus.evaluations = {
    status: evaluationStage.status,
    count: Array.isArray(evaluationStage.result.evaluations) ? evaluationStage.result.evaluations.length : 0,
    error: evaluationStage.error
  };
  const evaluations = Array.isArray(evaluationStage.result.evaluations) ? evaluationStage.result.evaluations : [];

  const kpiStage = await runStage(
    'metrics',
    () => (deps && deps.buildPatrolKpisFromEvaluations ? deps.buildPatrolKpisFromEvaluations : buildPatrolKpisFromEvaluations)(Object.assign({}, options, {
      reviewUnits,
      evaluations,
      llmActionLogs,
      joinDiagnostics: extractorStage.result && extractorStage.result.joinDiagnostics
        ? extractorStage.result.joinDiagnostics
        : null,
      transcriptCoverage: extractorStage.result && extractorStage.result.transcriptCoverage
        ? extractorStage.result.transcriptCoverage
        : null
    }), deps),
    () => createEmptyKpiResult()
  );
  runtimeFetchStatus.metrics = {
    status: kpiStage.status,
    reviewUnitCount: kpiStage.result && kpiStage.result.summary ? kpiStage.result.summary.reviewUnitCount : 0,
    error: kpiStage.error
  };
  const kpiResult = kpiStage.result;

  const detectionStage = await runStage(
    'detection',
    async () => (deps && deps.detectIssues ? deps.detectIssues : detectIssues)({ kpiResult }),
    () => createEmptyDetectionResult()
  );
  runtimeFetchStatus.detection = {
    status: detectionStage.status,
    issueCount: detectionStage.result && detectionStage.result.summary ? detectionStage.result.summary.issueCount : 0,
    error: detectionStage.error
  };
  const detectionResult = detectionStage.result;

  const rootCauseStage = await runStage(
    'rootCause',
    () => (deps && deps.analyzeQualityIssues ? deps.analyzeQualityIssues : analyzeQualityIssues)(Object.assign({}, options, {
      reviewUnits,
      evaluations,
      kpiResult,
      detectionResult,
      traceBundles
    }), deps),
    () => createEmptyRootCauseResult()
  );
  runtimeFetchStatus.rootCause = {
    status: rootCauseStage.status,
    reportCount: rootCauseStage.result && rootCauseStage.result.summary ? rootCauseStage.result.summary.reportCount : 0,
    error: rootCauseStage.error
  };
  const rootCauseResult = rootCauseStage.result;

  const planningStage = await runStage(
    'planning',
    () => (deps && deps.planQualityImprovements ? deps.planQualityImprovements : planQualityImprovements)(Object.assign({}, options, {
      reviewUnits,
      evaluations,
      kpiResult,
      detectionResult,
      rootCauseResult,
      traceBundles,
      generatedAt
    }), deps),
    () => createEmptyPlanResult(generatedAt)
  );
  runtimeFetchStatus.planning = {
    status: planningStage.status,
    proposalCount: Array.isArray(planningStage.result.recommendedPr) ? planningStage.result.recommendedPr.length : 0,
    error: planningStage.error
  };
  const planResult = planningStage.result;

  const registryReadStatus = { status: 'ok', count: 0, error: null };
  const backlogReadStatus = { status: 'ok', count: 0, error: null };
  const issueLister = deps && deps.listOpenIssues ? deps.listOpenIssues : listOpenIssues;
  const backlogLister = deps && deps.listTopPriorityBacklog ? deps.listTopPriorityBacklog : listTopPriorityBacklog;

  const queryStage = await runStage(
    'query',
    () => (deps && deps.queryLatestPatrolInsights ? deps.queryLatestPatrolInsights : queryLatestPatrolInsights)(Object.assign({}, options, {
      generatedAt,
      reviewUnits,
      evaluations,
      kpiResult,
      detectionResult,
      rootCauseResult,
      planResult,
      joinDiagnostics: extractorStage.result && extractorStage.result.joinDiagnostics ? extractorStage.result.joinDiagnostics : null
    }), Object.assign({}, deps, {
      listOpenIssues: async (params, nestedDeps) => {
        try {
          const rows = await issueLister(params, nestedDeps);
          registryReadStatus.status = 'ok';
          registryReadStatus.count = Array.isArray(rows) ? rows.length : 0;
          registryReadStatus.error = null;
          return rows;
        } catch (error) {
          registryReadStatus.status = 'unavailable';
          registryReadStatus.count = 0;
          registryReadStatus.error = normalizeError(error);
          return [];
        }
      },
      listTopPriorityBacklog: async (params, nestedDeps) => {
        try {
          const rows = await backlogLister(params, nestedDeps);
          backlogReadStatus.status = 'ok';
          backlogReadStatus.count = Array.isArray(rows) ? rows.length : 0;
          backlogReadStatus.error = null;
          return rows;
        } catch (error) {
          backlogReadStatus.status = 'unavailable';
          backlogReadStatus.count = 0;
          backlogReadStatus.error = normalizeError(error);
          return [];
        }
      }
    })),
    () => buildFallbackQueryArtifact({
      generatedAt,
      audience: options.audience,
      mode: options.mode,
      reviewUnits,
      evaluations,
      kpiResult,
      detectionResult,
      rootCauseResult,
      planResult,
      joinDiagnostics: extractorStage.result && extractorStage.result.joinDiagnostics ? extractorStage.result.joinDiagnostics : null,
      existingIssues: [],
      existingBacklog: [],
      sourceCollections: uniqueStrings([]
        .concat(kpiResult.sourceCollections || [])
        .concat(detectionResult.sourceCollections || [])
        .concat(rootCauseResult.sourceCollections || [])
        .concat(planResult.sourceCollections || []))
    })
  );
  runtimeFetchStatus.query = {
    status: queryStage.status,
    error: queryStage.error
  };
  runtimeFetchStatus.registryRead = registryReadStatus;
  runtimeFetchStatus.backlogRead = backlogReadStatus;
  const queryResult = queryStage.result;

  const writeStatus = {
    requested: {
      issues: options.writeIssues === true,
      backlog: options.writeBacklog === true
    },
    executed: {
      issues: false,
      backlog: false
    },
    skipped: [],
    result: null
  };

  if (options.writeBacklog === true && options.writeIssues !== true) {
    writeStatus.skipped.push('write_backlog_requires_write_issues');
    runtimeFetchStatus.writeBacklog = {
      status: 'skipped',
      error: { code: 'write_backlog_requires_write_issues', message: '--write-backlog requires --write-issues in PR-10 foundation' }
    };
  }

  if (options.writeIssues === true) {
    const canWrite = runtimeFetchStatus.reviewUnits.status === 'ok'
      && runtimeFetchStatus.evaluations.status === 'ok'
      && runtimeFetchStatus.metrics.status === 'ok'
      && reviewUnits.length > 0;
    if (!canWrite) {
      writeStatus.skipped.push('pipeline_not_ready_for_write');
      runtimeFetchStatus.writeIssues = {
        status: 'skipped',
        error: { code: 'pipeline_not_ready_for_write', message: 'read-only pipeline must succeed with review units before write mode is allowed' }
      };
      if (options.writeBacklog === true) {
        runtimeFetchStatus.writeBacklog = {
          status: 'skipped',
          error: { code: 'pipeline_not_ready_for_write', message: 'backlog write is skipped because issue write preconditions were not met' }
        };
      }
    } else {
      const writeStage = await runStage(
        'writeIssues',
        () => (deps && deps.detectAndUpsertQualityIssues ? deps.detectAndUpsertQualityIssues : detectAndUpsertQualityIssues)({
          kpiResult,
          threadId: options.threadId,
          traceRefs: Array.isArray(queryResult.traceRefs) ? queryResult.traceRefs.map((item) => item && item.traceId).filter(Boolean) : [],
          persist: true,
          persistBacklog: options.writeBacklog === true
        }, deps),
        () => ({
          ok: false,
          persisted: false,
          backlogPersisted: false,
          upsertedIssues: [],
          upsertedBacklogs: []
        })
      );
      writeStatus.result = writeStage.result;
      writeStatus.executed.issues = writeStage.status === 'ok' && writeStage.result && writeStage.result.persisted === true;
      writeStatus.executed.backlog = writeStage.status === 'ok' && writeStage.result && writeStage.result.backlogPersisted === true;
      runtimeFetchStatus.writeIssues = {
        status: writeStage.status === 'ok' && writeStatus.executed.issues ? 'ok' : (writeStage.status === 'ok' ? 'skipped' : 'unavailable'),
        count: writeStage.result && Array.isArray(writeStage.result.upsertedIssues) ? writeStage.result.upsertedIssues.length : 0,
        error: writeStage.error
      };
      runtimeFetchStatus.writeBacklog = {
        status: options.writeBacklog === true
          ? ((writeStage.status === 'ok' && writeStatus.executed.backlog) ? 'ok' : (writeStage.status === 'ok' ? 'skipped' : 'unavailable'))
          : 'disabled',
        count: writeStage.result && Array.isArray(writeStage.result.upsertedBacklogs) ? writeStage.result.upsertedBacklogs.length : 0,
        error: writeStage.error
      };
      if (!writeStatus.executed.issues && !writeStage.error) writeStatus.skipped.push('write_wrapper_noop');
    }
  } else {
    runtimeFetchStatus.writeIssues = { status: 'disabled', count: 0, error: null };
    if (!runtimeFetchStatus.writeBacklog) runtimeFetchStatus.writeBacklog = { status: 'disabled', count: 0, error: null };
  }

  const sourceCollections = uniqueStrings([]
    .concat(queryResult.sourceCollections || [])
    .concat(kpiResult.sourceCollections || [])
    .concat(detectionResult.sourceCollections || [])
    .concat(rootCauseResult.sourceCollections || [])
    .concat(planResult.sourceCollections || []));

  return {
    generatedAt,
    options,
    sourceWindow,
    reviewUnits,
    evaluations,
    kpiResult,
    detectionResult,
    rootCauseResult,
    planResult,
    queryResult: Object.assign({}, queryResult, { sourceCollections }),
    runtimeFetchStatus,
    writeStatus
  };
}

function writeArtifact(pathname, payload) {
  writeJson(pathname, payload);
  return pathname;
}

function writeJobArtifacts(job, outputPaths) {
  const outputs = {};
  const mainArtifact = buildMainArtifact(job);
  outputs.main = writeArtifact(outputPaths.output, mainArtifact);
  if (outputPaths.metricsOutput) outputs.metrics = writeArtifact(outputPaths.metricsOutput, buildMetricsArtifact(job));
  if (outputPaths.detectionOutput) outputs.detection = writeArtifact(outputPaths.detectionOutput, buildDetectionArtifact(job));
  if (outputPaths.planningOutput) outputs.planning = writeArtifact(outputPaths.planningOutput, buildPlanningArtifact(job));
  return {
    outputs,
    artifacts: {
      main: mainArtifact,
      metrics: outputPaths.metricsOutput ? buildMetricsArtifact(job) : null,
      detection: outputPaths.detectionOutput ? buildDetectionArtifact(job) : null,
      planning: outputPaths.planningOutput ? buildPlanningArtifact(job) : null
    }
  };
}

module.exports = {
  MAIN_ARTIFACT_VERSION,
  METRICS_ARTIFACT_VERSION,
  DETECTION_ARTIFACT_VERSION,
  PLANNING_ARTIFACT_VERSION,
  JOB_PROVENANCE,
  parsePatrolArgs,
  runQualityPatrolPipeline,
  buildMainArtifact,
  buildMetricsArtifact,
  buildDetectionArtifact,
  buildPlanningArtifact,
  writeJobArtifacts,
  resolveOutputPath,
  normalizeMode,
  normalizeAudience,
  normalizeError
};
