'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { parseArgs, readJson, writeJson } = require('./lib');

function validateManifest(manifest) {
  const payload = manifest && typeof manifest === 'object' ? manifest : {};
  const errors = [];
  if (typeof payload.version !== 'string' || !payload.version.trim()) errors.push('missing_version');
  if (payload.frozen !== true) errors.push('benchmark_not_frozen');
  if (!Array.isArray(payload.fixtures) || payload.fixtures.length === 0) errors.push('missing_fixtures');
  if (!Array.isArray(payload.sourceSnapshots) || payload.sourceSnapshots.length === 0) errors.push('missing_source_snapshots');

  const fixtures = Array.isArray(payload.fixtures) ? payload.fixtures : [];
  fixtures.forEach((fixture, index) => {
    if (!fixture || typeof fixture !== 'object') {
      errors.push(`fixture_invalid_${index}`);
      return;
    }
    if (!fixture.id) errors.push(`fixture_missing_id_${index}`);
    if (!fixture.path) errors.push(`fixture_missing_path_${index}`);
    if (!fixture.version) errors.push(`fixture_missing_version_${index}`);
    if (!fixture.contaminationRisk) errors.push(`fixture_missing_contamination_${index}`);
  });

  return {
    ok: errors.length === 0,
    errors,
    version: typeof payload.version === 'string' ? payload.version : 'unknown',
    frozen: payload.frozen === true,
    artifactHash: typeof payload.artifactHash === 'string' ? payload.artifactHash : null,
    fixtureCount: fixtures.length,
    sourceSnapshotCount: Array.isArray(payload.sourceSnapshots) ? payload.sourceSnapshots.length : 0
  };
}

function checkFixturePaths(manifestPath, manifest) {
  const payload = manifest && typeof manifest === 'object' ? manifest : {};
  const baseDir = path.dirname(manifestPath);
  const missing = [];
  const fixtures = Array.isArray(payload.fixtures) ? payload.fixtures : [];
  fixtures.forEach((fixture) => {
    const rel = fixture && typeof fixture.path === 'string' ? fixture.path : '';
    if (!rel) return;
    const absolute = path.resolve(baseDir, '..', rel.replace(/^benchmarks\//, ''));
    if (!fs.existsSync(absolute)) missing.push(rel);
  });
  return missing;
}

function main(argv) {
  const args = parseArgs(argv);
  const manifestPath = args.manifest
    ? path.resolve(process.cwd(), args.manifest)
    : path.join(process.cwd(), 'benchmarks', 'registry', 'manifest.v1.json');
  const outPath = args.output
    ? path.resolve(process.cwd(), args.output)
    : path.join(process.cwd(), 'tmp', 'llm_quality_benchmark_registry.json');

  const manifest = readJson(manifestPath);
  const result = validateManifest(manifest);
  const missingFixturePaths = checkFixturePaths(manifestPath, manifest);
  if (missingFixturePaths.length > 0) {
    result.ok = false;
    result.errors.push('fixture_path_missing');
  }
  result.missingFixturePaths = missingFixturePaths;
  writeJson(outPath, result);
  process.stdout.write(`${JSON.stringify({ ok: result.ok, outPath, result }, null, 2)}\n`);
  return result.ok ? 0 : 1;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  validateManifest,
  main
};
