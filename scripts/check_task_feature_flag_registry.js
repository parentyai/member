'use strict';

const fs = require('fs');
const path = require('path');

const SOURCE_PATH = path.join(__dirname, '..', 'src', 'domain', 'tasks', 'featureFlags.js');
const { getTaskFeatureFlagRegistry } = require('../src/domain/tasks/featureFlags');

function collectFlagNamesFromSource(text) {
  const names = new Set();
  const parserRegex = /parse(?:Flag|Number)\(\s*'([A-Z0-9_]+)'/g;
  let match = parserRegex.exec(text);
  while (match) {
    names.add(match[1]);
    match = parserRegex.exec(text);
  }

  const envRegex = /process\.env\.([A-Z0-9_]+)/g;
  match = envRegex.exec(text);
  while (match) {
    names.add(match[1]);
    match = envRegex.exec(text);
  }
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function run() {
  const errors = [];
  const source = fs.readFileSync(SOURCE_PATH, 'utf8');
  const sourceFlags = collectFlagNamesFromSource(source);
  const registryRows = getTaskFeatureFlagRegistry();
  const registryByName = new Map();

  for (const row of registryRows) {
    if (!row || typeof row.name !== 'string' || !row.name.trim()) {
      errors.push('registry entry missing name');
      continue;
    }
    if (registryByName.has(row.name)) {
      errors.push(`duplicate registry entry: ${row.name}`);
      continue;
    }
    registryByName.set(row.name, row);
  }

  for (const name of sourceFlags) {
    if (!registryByName.has(name)) {
      errors.push(`missing registry entry: ${name}`);
    }
  }

  for (const [name, row] of registryByName.entries()) {
    if (!sourceFlags.includes(name)) {
      errors.push(`registry entry not referenced in featureFlags.js parse helpers: ${name}`);
    }
    if (typeof row.owner !== 'string' || !row.owner.trim()) {
      errors.push(`registry owner missing: ${name}`);
    }
    if (!isIsoDate(row.reviewBy)) {
      errors.push(`registry reviewBy invalid (YYYY-MM-DD required): ${name}`);
    }
    if (typeof row.rationale !== 'string' || !row.rationale.trim()) {
      errors.push(`registry rationale missing: ${name}`);
    }
    if (row.defaultValue === undefined) {
      errors.push(`registry defaultValue missing: ${name}`);
    }
  }

  if (errors.length) {
    console.error('[feature-flags] task registry check failed');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log('[feature-flags] task registry check passed');
  console.log(`[feature-flags] flags=${sourceFlags.length}`);
}

run();
