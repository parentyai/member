'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  resolveHarnessRunId,
  resolveRunScopedArtifactGroup,
  writeHarnessArtifact
} = require('./harness_shared');

function parseArgs(argv) {
  const out = {};
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  for (let i = 0; i < args.length; i += 1) {
    const current = args[i];
    if (!current || !current.startsWith('--')) continue;
    const key = current.slice(2);
    const next = args[i + 1];
    out[key] = next && !next.startsWith('--') ? next : true;
  }
  return out;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function parseNumber(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return num;
}

function toMillis(value) {
  if (!value) return 0;
  const date = new Date(value);
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : 0;
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

function normalizeRuntimeSummarySource(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function isFixtureSeededSource(source) {
  return [
    'seeded_from_fixture',
    'forced_refresh_from_seed',
    'existing_stale_reseeded',
    'existing_invalid_reseeded'
  ].includes(source);
}

function isFrozenRuntimeSeed(seed) {
  if (!seed || typeof seed !== 'object') return false;
  const source = normalizeRuntimeSummarySource(seed.runtimeSummarySource);
  return source === 'frozen_runtime_snapshot';
}

function hasQualityFramework(payload) {
  return Boolean(
    payload
    && typeof payload === 'object'
    && payload.summary
    && typeof payload.summary === 'object'
    && payload.summary.qualityFramework
    && typeof payload.summary.qualityFramework === 'object'
  );
}

const STRICT_RUNTIME_REQUIRED_CONVERSATION_QUALITY_KEYS = Object.freeze([
  'legacyTemplateHitRate',
  'defaultCasualRate',
  'followupQuestionIncludedRate',
  'conciseModeAppliedRate',
  'retrieveNeededRate',
  'avgActionCount',
  'directAnswerAppliedRate',
  'avgRepeatRiskScore',
  'formatComplianceRate',
  'detailCarryRate',
  'correctionRecoveryRate',
  'mixedDomainRetentionRate',
  'citySpecificityResolvedRate',
  'cityOverclaimRate',
  'transformSourceCarryRate',
  'depthResetRate',
  'followupOveraskRate',
  'internalLabelLeakRate',
  'parrotEchoRate',
  'commandBoundaryCollisionRate',
  'domainIntentConciergeRate',
  'officialOnlySatisfiedRate',
  'followupResolutionRate',
  'contextualResumeHandledRate',
  'avgUnsupportedClaimCount',
  'oneTurnUtilityRate',
  'procedureScaffoldCoverageRate',
  'relevanceFitRate',
  'offTargetAnswerRate',
  'decisionReadinessRate',
  'dependencyExplicitnessRate',
  'fakeSpecificityRate',
  'userEffortShiftRate',
  'procedureKnowledgeUseRate',
  'transformBadFactCarryRate'
]);

function missingStrictRuntimeKeys(payload) {
  const conversationQuality = payload
    && payload.summary
    && typeof payload.summary === 'object'
    && payload.summary.conversationQuality
    && typeof payload.summary.conversationQuality === 'object'
    ? payload.summary.conversationQuality
    : {};
  return STRICT_RUNTIME_REQUIRED_CONVERSATION_QUALITY_KEYS.filter((key) => {
    const value = conversationQuality[key];
    return typeof value !== 'number' || Number.isNaN(value);
  });
}

function main(argv) {
  const args = parseArgs(argv);
  const outPath = args.output
    ? path.resolve(process.cwd(), String(args.output))
    : path.resolve(process.cwd(), 'tmp', 'llm_usage_summary.json');
  const seedPath = args.seed
    ? path.resolve(process.cwd(), String(args.seed))
    : path.resolve(process.cwd(), 'tools', 'llm_quality', 'fixtures', 'usage_summary_candidate.v1.json');
  const refreshRequested = String(args.refresh || '').toLowerCase() === 'true' || args.refresh === true;
  const maxAgeMinutes = Math.max(0, parseNumber(args['max-age-minutes'], 30));
  const strictRuntime = toBool(
    args['strict-runtime'],
    toBool(process.env.LLM_QUALITY_PREPARE_STRICT_RUNTIME, false)
  );
  const now = Date.now();

  let mode = 'seeded_from_fixture';
  let reseedRequired = false;
  if (fs.existsSync(outPath)) {
    try {
      const existing = readJson(outPath);
      if (hasQualityFramework(existing)) {
        const existingSource = normalizeRuntimeSummarySource(existing.runtimeSummarySource);
        const preparedAtMs = toMillis(existing.preparedAt);
        const ageMinutes = preparedAtMs > 0 ? ((now - preparedAtMs) / 60000) : Number.POSITIVE_INFINITY;
        const stale = ageMinutes > maxAgeMinutes;
        const fixtureSeededSource = isFixtureSeededSource(existingSource);
        const strictMissingKeys = strictRuntime ? missingStrictRuntimeKeys(existing) : [];
        const strictCoverageInvalid = strictRuntime && strictMissingKeys.length > 0;
        if (!refreshRequested && !stale && !(strictRuntime && fixtureSeededSource) && !strictCoverageInvalid) {
          mode = 'existing_runtime_summary_kept';
          const result = {
            ok: true,
            mode,
            outputPath: outPath,
            seedPath,
            strictRuntime,
            maxAgeMinutes,
            ageMinutes: Math.round(ageMinutes * 100) / 100
          };
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
          return 0;
        }
        reseedRequired = true;
        if (strictCoverageInvalid) {
          mode = 'existing_missing_strict_runtime_signals_reseeded';
        } else if (strictRuntime && fixtureSeededSource) {
          mode = 'existing_fixture_seed_disallowed_in_strict';
        } else {
          mode = refreshRequested ? 'forced_refresh_from_seed' : 'existing_stale_reseeded';
        }
      }
    } catch (_) {
      reseedRequired = true;
      mode = 'existing_invalid_reseeded';
    }
  }

  const seed = readJson(seedPath);
  if (!hasQualityFramework(seed)) {
    process.stderr.write(`${JSON.stringify({
      ok: false,
      error: 'seed_quality_framework_missing',
      seedPath
    }, null, 2)}\n`);
    return 1;
  }

  const frozenRuntimeSeed = isFrozenRuntimeSeed(seed);
  if (strictRuntime && !frozenRuntimeSeed) {
    process.stderr.write(`${JSON.stringify({
      ok: false,
      error: 'strict_runtime_requires_frozen_runtime_snapshot_seed',
      outputPath: outPath,
      seedPath,
      strictRuntime
    }, null, 2)}\n`);
    return 1;
  }

  if (strictRuntime) {
    if (mode === 'forced_refresh_from_seed') mode = 'forced_refresh_from_frozen_runtime_snapshot';
    else if (mode === 'seeded_from_fixture' || reseedRequired) mode = 'seeded_from_frozen_runtime_snapshot';
  }

  const outputPayload = Object.assign({}, seed, {
    preparedAt: new Date().toISOString(),
    runtimeSummarySource: mode
  });
  const artifact = writeHarnessArtifact({
    outputPath: outPath,
    value: outputPayload,
    runId: resolveHarnessRunId({ env: process.env, sourceTag: 'runtime-summary' }),
    artifactGroup: resolveRunScopedArtifactGroup('summary')
  });

  process.stdout.write(`${JSON.stringify({
    ok: true,
    mode,
    outputPath: artifact.outputPath,
    runScopedOutputPath: artifact.runScopedPath,
    seedPath,
    strictRuntime,
    maxAgeMinutes
  }, null, 2)}\n`);
  return 0;
}

if (require.main === module) {
  process.exitCode = main(process.argv);
}

module.exports = {
  main
};
