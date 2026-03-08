'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const {
  ROOT,
  REGISTRY_PATH,
  DOC_PATH,
  collectEnableFlagOccurrences,
  inferOwner,
  inferBlastRadius
} = require('./feature_flag_registry_common');

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_err) {
    return fallback;
  }
}

function git(command) {
  try {
    return childProcess.execSync(command, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8').trim();
  } catch (_err) {
    return null;
  }
}

function normalizeEntry(flag, existing, refs, defaultHints) {
  const current = existing && typeof existing === 'object' ? existing : {};
  const defaultValue = typeof current.defaultValue === 'boolean'
    ? current.defaultValue
    : (defaultHints.has(flag) ? defaultHints.get(flag) : false);
  const purpose = typeof current.purpose === 'string' && current.purpose.trim()
    ? current.purpose.trim()
    : `Runtime gate for ${flag.toLowerCase()}`;
  return {
    name: flag,
    owner: typeof current.owner === 'string' && current.owner.trim()
      ? current.owner.trim()
      : inferOwner(flag),
    purpose,
    defaultValue,
    defaultRationale: typeof current.defaultRationale === 'string' && current.defaultRationale.trim()
      ? current.defaultRationale.trim()
      : 'env unset fallback follows code default',
    reviewBy: typeof current.reviewBy === 'string' && current.reviewBy.trim()
      ? current.reviewBy.trim()
      : '2026-09-30',
    blastRadius: typeof current.blastRadius === 'string' && current.blastRadius.trim()
      ? current.blastRadius.trim()
      : inferBlastRadius(flag),
    sourceRefs: Array.isArray(current.sourceRefs) && current.sourceRefs.length
      ? current.sourceRefs
      : (refs.get(flag) || []),
    status: typeof current.status === 'string' && current.status.trim()
      ? current.status.trim()
      : 'active'
  };
}

function writeRegistryDoc(payload) {
  const rows = Array.isArray(payload.flags) ? payload.flags : [];
  const lines = [];
  lines.push('# FEATURE_FLAG_GOVERNANCE');
  lines.push('');
  lines.push(`- generatedAt: ${payload.generatedAt || 'UNOBSERVED_RUNTIME'}`);
  lines.push(`- gitCommit: ${payload.gitCommit || 'UNOBSERVED_RUNTIME'}`);
  lines.push(`- branch: ${payload.branch || 'UNOBSERVED_RUNTIME'}`);
  lines.push(`- flagCount: ${rows.length}`);
  lines.push('- source: src/**/*.js');
  lines.push('- check: `npm run feature-flags:check`');
  lines.push('');
  lines.push('| Flag | Owner | Default | ReviewBy | BlastRadius | Purpose | Source |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  rows.forEach((row) => {
    const refs = Array.isArray(row.sourceRefs) ? row.sourceRefs.slice(0, 2).join('<br>') : '';
    const purpose = String(row.purpose || '').replace(/\|/g, '\\|');
    lines.push(`| ${row.name} | ${row.owner} | ${row.defaultValue} | ${row.reviewBy} | ${row.blastRadius} | ${purpose} | ${refs} |`);
  });
  lines.push('');
  fs.writeFileSync(DOC_PATH, `${lines.join('\n')}\n`, 'utf8');
}

function run() {
  const { flags, refs, defaultHints } = collectEnableFlagOccurrences();
  const current = readJson(REGISTRY_PATH, { flags: [] });
  const currentMap = new Map(
    (Array.isArray(current.flags) ? current.flags : [])
      .filter((row) => row && typeof row.name === 'string' && row.name.trim())
      .map((row) => [row.name.trim(), row])
  );

  const registryRows = flags.map((flag) => normalizeEntry(flag, currentMap.get(flag), refs, defaultHints));
  registryRows.sort((a, b) => a.name.localeCompare(b.name));

  const payload = {
    generatedAt: new Date().toISOString(),
    gitCommit: git('git rev-parse HEAD'),
    branch: git('git branch --show-current'),
    flags: registryRows
  };

  fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
  fs.writeFileSync(REGISTRY_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  writeRegistryDoc(payload);
  console.log(`[feature-flags] generated registry: ${path.relative(ROOT, REGISTRY_PATH)} (${registryRows.length})`);
  console.log(`[feature-flags] generated doc: ${path.relative(ROOT, DOC_PATH)}`);
}

run();
