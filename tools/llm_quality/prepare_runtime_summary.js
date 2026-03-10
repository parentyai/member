'use strict';

const fs = require('node:fs');
const path = require('node:path');

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
  const now = Date.now();

  let mode = 'seeded_from_fixture';
  if (fs.existsSync(outPath)) {
    try {
      const existing = readJson(outPath);
      if (hasQualityFramework(existing)) {
        const preparedAtMs = toMillis(existing.preparedAt);
        const ageMinutes = preparedAtMs > 0 ? ((now - preparedAtMs) / 60000) : Number.POSITIVE_INFINITY;
        const stale = ageMinutes > maxAgeMinutes;
        if (!refreshRequested && !stale) {
          mode = 'existing_runtime_summary_kept';
          const result = {
            ok: true,
            mode,
            outputPath: outPath,
            seedPath,
            maxAgeMinutes,
            ageMinutes: Math.round(ageMinutes * 100) / 100
          };
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
          return 0;
        }
        mode = refreshRequested ? 'forced_refresh_from_seed' : 'existing_stale_reseeded';
      }
    } catch (_) {
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

  const outputPayload = Object.assign({}, seed, {
    preparedAt: new Date().toISOString(),
    runtimeSummarySource: mode
  });
  writeJson(outPath, outputPayload);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    mode,
    outputPath: outPath,
    seedPath,
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
