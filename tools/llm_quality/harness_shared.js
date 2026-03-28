'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { writeJson } = require('./lib');

const RUN_ARTIFACT_ROOT = path.join('tmp', 'llm_quality_runs');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toBool(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

function parseRate(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (num < 0) return 0;
  if (num > 1) return 1;
  return num;
}

function normalizeRuntimeSummarySource(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function isRuntimeSummaryProvenanceAccepted(value) {
  const source = normalizeRuntimeSummarySource(value);
  if (!source) return false;
  return [
    'seeded_from_frozen_runtime_snapshot',
    'forced_refresh_from_frozen_runtime_snapshot',
    'frozen_summary_fallback',
    'runtime_live',
    'runtime_summary_live',
    'runtime_collected',
    'existing_runtime_summary_kept'
  ].includes(source);
}

function isLiveRuntimeSummaryProvenance(value) {
  const source = normalizeRuntimeSummarySource(value);
  if (!source) return false;
  return [
    'runtime_live',
    'runtime_summary_live',
    'runtime_collected',
    'existing_runtime_summary_kept'
  ].includes(source);
}

function resolveHarnessRunId(options) {
  const payload = options && typeof options === 'object' ? options : {};
  const env = payload.env && typeof payload.env === 'object' ? payload.env : process.env;
  const explicit = normalizeText(payload.runId);
  if (explicit) return explicit;

  const envCandidates = [
    env.LLM_QUALITY_RUN_ID,
    env.GITHUB_RUN_ID,
    env.GITHUB_RUN_ATTEMPT,
    env.CI_PIPELINE_ID,
    env.CI_JOB_ID,
    env.BUILD_ID,
    env.RUN_ID
  ];
  for (const candidate of envCandidates) {
    const normalized = normalizeText(candidate);
    if (normalized) return normalized;
  }

  const sourceTag = normalizeText(payload.sourceTag) || 'local';
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  return `${sourceTag}-${stamp}-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
}

function resolveHarnessArtifactPath(options) {
  const payload = options && typeof options === 'object' ? options : {};
  const root = payload.root ? path.resolve(payload.root) : process.cwd();
  const runId = resolveHarnessRunId({
    env: payload.env,
    runId: payload.runId,
    sourceTag: payload.sourceTag
  });
  const artifactGroup = normalizeText(payload.artifactGroup) || 'artifacts';
  const fileName = normalizeText(payload.fileName)
    || path.basename(normalizeText(payload.outputPath) || 'artifact.json');
  return path.join(root, RUN_ARTIFACT_ROOT, runId, artifactGroup, fileName);
}

function writeHarnessArtifact(options) {
  const payload = options && typeof options === 'object' ? options : {};
  const outputPath = payload.outputPath ? path.resolve(payload.outputPath) : null;
  const artifactGroup = normalizeText(payload.artifactGroup) || 'artifacts';
  const root = payload.root ? path.resolve(payload.root) : process.cwd();
  const runId = resolveHarnessRunId({
    env: payload.env,
    runId: payload.runId,
    sourceTag: payload.sourceTag
  });
  const runScopedPath = outputPath
    ? resolveHarnessArtifactPath({
      root,
      runId,
      artifactGroup,
      outputPath
    })
    : null;

  if (!outputPath) {
    throw new Error('outputPath is required');
  }

  writeJson(outputPath, payload.value);
  if (runScopedPath && path.resolve(runScopedPath) !== outputPath) {
    writeJson(runScopedPath, payload.value);
  }

  return {
    runId,
    outputPath,
    runScopedPath
  };
}

function readJsonIfExists(filePath) {
  if (!filePath) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_err) {
    return null;
  }
}

function readSummaryData(summaryPath) {
  const payload = readJsonIfExists(summaryPath);
  if (!payload || typeof payload !== 'object') return null;
  if (payload.summary && typeof payload.summary === 'object') {
    return Object.assign({}, payload.summary, {
      runtimeSummarySource: typeof payload.runtimeSummarySource === 'string'
        ? payload.runtimeSummarySource
        : payload.summary.runtimeSummarySource,
      preparedAt: typeof payload.preparedAt === 'string'
        ? payload.preparedAt
        : payload.summary.preparedAt
    });
  }
  return payload;
}

function extractQualityLoopV2(summary) {
  if (!summary || typeof summary !== 'object') return null;
  const summaryNode = summary.summary && typeof summary.summary === 'object'
    ? summary.summary
    : summary;
  const qualityFramework = summaryNode.qualityFramework && typeof summaryNode.qualityFramework === 'object'
    ? summaryNode.qualityFramework
    : null;
  if (!qualityFramework || !qualityFramework.qualityLoopV2 || typeof qualityFramework.qualityLoopV2 !== 'object') {
    return null;
  }
  return qualityFramework.qualityLoopV2;
}

function resolveQualityPolicyFlags(options) {
  const payload = options && typeof options === 'object' ? options : {};
  const env = payload.env && typeof payload.env === 'object' ? payload.env : process.env;
  return {
    requireAllSlicesPass: toBool(
      payload.requireAllSlicesPass,
      toBool(env.LLM_QUALITY_REQUIRE_ALL_SLICES_PASS, false)
    ),
    requireRuntimeSummary: toBool(
      payload.requireRuntimeSummary,
      toBool(env.LLM_QUALITY_REQUIRE_RUNTIME_SUMMARY, false)
    ),
    requireRuntimeProvenance: toBool(
      payload.requireRuntimeProvenance,
      toBool(env.LLM_QUALITY_REQUIRE_RUNTIME_PROVENANCE, false)
    ),
    requireCompatGovernance: toBool(
      payload.requireCompatGovernance,
      toBool(env.LLM_QUALITY_REQUIRE_COMPAT_GOVERNANCE, false)
    ),
    requireLiveRuntimeAudit: toBool(
      payload.requireLiveRuntimeAudit,
      toBool(env.LLM_QUALITY_REQUIRE_LIVE_RUNTIME_AUDIT, false)
    ),
    requireNoGoGateMandatory: toBool(
      payload.requireNoGoGateMandatory,
      toBool(env.LLM_QUALITY_REQUIRE_NOGO_GATE_MANDATORY, false)
    ),
    requireStrictRuntimeSignals: toBool(
      payload.requireStrictRuntimeSignals,
      toBool(env.LLM_QUALITY_REQUIRE_STRICT_RUNTIME_SIGNALS, false)
    ),
    requireSoftFloor: toBool(
      payload.requireSoftFloor,
      toBool(env.LLM_QUALITY_REQUIRE_SOFT_FLOOR_080, false)
    ),
    maxCompatShare: parseRate(
      payload.maxCompatShare,
      parseRate(env.LLM_QUALITY_MAX_COMPAT_SHARE, 0.15)
    ),
    softFloorValue: Number.isFinite(Number(payload.softFloor))
      ? Number(payload.softFloor)
      : Number.isFinite(Number(env.LLM_QUALITY_SOFT_FLOOR_VALUE))
        ? Number(env.LLM_QUALITY_SOFT_FLOOR_VALUE)
        : 0.8
  };
}

function resolveRunScopedArtifactGroup(scriptName) {
  const normalized = normalizeText(scriptName).toLowerCase();
  if (!normalized) return 'artifacts';
  if (normalized.includes('scorecard')) return 'scorecard';
  if (normalized.includes('gate')) return 'gate';
  if (normalized.includes('policy')) return 'policy';
  if (normalized.includes('report')) return 'report';
  if (normalized.includes('register')) return 'register';
  if (normalized.includes('queue')) return 'queue';
  if (normalized.includes('summary')) return 'summary';
  if (normalized.includes('audit')) return 'audit';
  if (normalized.includes('must-pass')) return 'must-pass';
  return normalized.replace(/[^a-z0-9_-]+/g, '-') || 'artifacts';
}

module.exports = {
  RUN_ARTIFACT_ROOT,
  extractQualityLoopV2,
  isLiveRuntimeSummaryProvenance,
  isRuntimeSummaryProvenanceAccepted,
  normalizeRuntimeSummarySource,
  readJsonIfExists,
  readSummaryData,
  resolveHarnessArtifactPath,
  resolveHarnessRunId,
  resolveQualityPolicyFlags,
  resolveRunScopedArtifactGroup,
  toBool,
  parseRate,
  writeHarnessArtifact
};
