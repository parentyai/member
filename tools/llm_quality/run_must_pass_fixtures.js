'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  resolveHarnessRunId,
  resolveRunScopedArtifactGroup,
  writeHarnessArtifact
} = require('./harness_shared');

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  const out = {};
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    if (!key.startsWith('--')) continue;
    const next = args[i + 1];
    out[key.slice(2)] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) i += 1;
  }
  return out;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function toMap(rows, keyField) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row || typeof row !== 'object') return;
    const key = typeof row[keyField] === 'string' ? row[keyField].trim() : '';
    if (!key) return;
    map.set(key, row);
  });
  return map;
}

function normalizeSliceArray(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  if (Array.isArray(source.slices)) return source.slices;
  if (source.slices && typeof source.slices === 'object') {
    return Object.keys(source.slices).map((sliceKey) => {
      const row = source.slices[sliceKey] && typeof source.slices[sliceKey] === 'object' ? source.slices[sliceKey] : {};
      const score = Number.isFinite(Number(row.score)) ? Number(row.score) : 0;
      const status = score >= 0.75 ? 'pass' : (score >= 0.6 ? 'warning' : 'fail');
      return Object.assign({ sliceKey, score, status }, row);
    });
  }
  return [];
}

function runNodeScript(scriptPath, args, cwd) {
  const run = spawnSync('node', [scriptPath].concat(args || []), {
    cwd,
    encoding: 'utf8'
  });
  const stdout = typeof run.stdout === 'string' ? run.stdout.trim() : '';
  const stderr = typeof run.stderr === 'string' ? run.stderr.trim() : '';
  let payload = null;
  const body = stdout || stderr;
  if (body) {
    try {
      payload = JSON.parse(body);
    } catch (_err) {
      payload = null;
    }
  }
  return {
    status: Number.isInteger(run.status) ? run.status : 1,
    ok: run.status === 0,
    stdout,
    stderr,
    payload
  };
}

function runCommandCheck(definition, cwd) {
  const payload = definition && typeof definition === 'object' ? definition : {};
  const fixture = typeof payload.fixture === 'string' ? payload.fixture.trim() : '';
  const command = Array.isArray(payload.command)
    ? payload.command.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  if (!fixture || command.length === 0) return null;
  const run = spawnSync(command[0], command.slice(1), {
    cwd,
    encoding: 'utf8'
  });
  return {
    fixture,
    pass: run.status === 0,
    critical: payload.critical !== false,
    reason: run.status === 0 ? null : 'command_check_failed',
    command,
    exitStatus: Number.isInteger(run.status) ? run.status : 1
  };
}

function evaluateScorecardSlices(baseline, candidate) {
  const baselineSlices = toMap(normalizeSliceArray(baseline), 'sliceKey');
  const candidateSlices = toMap(normalizeSliceArray(candidate), 'sliceKey');
  const checks = [
    { key: 'short_followup', critical: true },
    { key: 'domain_continuation', critical: true },
    { key: 'japanese_service_quality', critical: true },
    { key: 'minority_personas', critical: true },
    { key: 'cultural_slices', critical: true },
    { key: 'group_chat', critical: true }
  ].map((item) => {
    const before = baselineSlices.get(item.key) || {};
    const after = candidateSlices.get(item.key) || {};
    const beforeScore = Number(before.score || 0);
    const afterScore = Number(after.score || 0);
    const improved = afterScore >= beforeScore;
    const pass = after.status === 'pass' && improved;
    return {
      fixture: `slice:${item.key}`,
      pass,
      critical: item.critical === true,
      baselineScore: beforeScore,
      candidateScore: afterScore,
      candidateStatus: after.status || 'unknown',
      reason: pass ? null : 'slice_not_pass_or_not_improved'
    };
  });
  return checks;
}

function main(argv) {
  const args = parseArgs(argv);
  const root = process.cwd();
  const fixtureListPath = args.fixtureList
    ? path.resolve(root, args.fixtureList)
    : path.join(root, 'tools', 'llm_quality', 'fixtures', 'must_pass_fixture_list.v1.json');
  const baselinePath = args.baseline
    ? path.resolve(root, args.baseline)
    : path.join(root, 'tmp', 'llm_quality_baseline_scorecard.json');
  const candidatePath = args.candidate
    ? path.resolve(root, args.candidate)
    : path.join(root, 'tmp', 'llm_quality_candidate_scorecard.json');
  const outPath = args.output
    ? path.resolve(root, args.output)
    : path.join(root, 'tmp', 'llm_quality_must_pass_result.json');

  const baseline = readJson(baselinePath);
  const candidate = readJson(candidatePath);
  const fixtureList = readJson(fixtureListPath);

  const checks = [];

  const golden = runNodeScript(path.join('tools', 'run_paid_llm_golden_eval.js'), [], root);
  checks.push({
    fixture: 'paid_golden_eval',
    pass: golden.ok,
    critical: true,
    reason: golden.ok ? null : 'paid_golden_eval_failed'
  });

  const arena = runNodeScript(path.join('tools', 'llm_replay', 'run_replay_arena.js'), [], root);
  checks.push({
    fixture: 'replay_arena',
    pass: arena.ok,
    critical: true,
    reason: arena.ok ? null : 'replay_arena_failed'
  });

  checks.push(...evaluateScorecardSlices(baseline, candidate));

  const commandChecks = Array.isArray(fixtureList && fixtureList.commandChecks)
    ? fixtureList.commandChecks
    : [];
  commandChecks.forEach((definition) => {
    const result = runCommandCheck(definition, root);
    if (result) checks.push(result);
  });

  const required = Array.isArray(fixtureList && fixtureList.required) ? fixtureList.required : [];
  const checkMap = new Map(checks.map((row) => [row.fixture, row]));
  required.forEach((fixture) => {
    if (checkMap.has(fixture)) return;
    checks.push({
      fixture,
      pass: false,
      critical: true,
      reason: 'required_fixture_not_checked'
    });
  });

  const failures = checks.filter((row) => row.pass !== true);
  const criticalFailures = failures.filter((row) => row.critical === true);
  const result = {
    ok: criticalFailures.length === 0,
    generatedAt: new Date().toISOString(),
    fixtureListPath,
    baselinePath,
    candidatePath,
    requiredFixtures: required,
    checks,
    failureCount: failures.length,
    criticalFailureCount: criticalFailures.length
  };

  const artifact = writeHarnessArtifact({
    outputPath: outPath,
    value: result,
    runId: resolveHarnessRunId({ env: process.env, sourceTag: 'must-pass' }),
    artifactGroup: resolveRunScopedArtifactGroup('must-pass')
  });
  const target = result.ok ? process.stdout : process.stderr;
  target.write(`${JSON.stringify(Object.assign({}, result, {
    outputPath: artifact.outputPath,
    runScopedOutputPath: artifact.runScopedPath
  }), null, 2)}\n`);
  return result.ok ? 0 : 1;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  main
};
