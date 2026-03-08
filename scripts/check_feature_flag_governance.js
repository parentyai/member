'use strict';

const fs = require('fs');
const {
  REGISTRY_PATH,
  DOC_PATH,
  collectEnableFlagOccurrences
} = require('./feature_flag_registry_common');

function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function run() {
  const errors = [];
  const warnings = [];
  const { flags: sourceFlags } = collectEnableFlagOccurrences();

  if (!fs.existsSync(REGISTRY_PATH)) {
    console.error('[feature-flags] registry missing:', REGISTRY_PATH);
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const rows = Array.isArray(payload.flags) ? payload.flags : [];
  const byName = new Map();

  rows.forEach((row) => {
    const name = row && typeof row.name === 'string' ? row.name.trim() : '';
    if (!name) {
      errors.push('registry row missing name');
      return;
    }
    if (byName.has(name)) {
      errors.push(`duplicate registry row: ${name}`);
      return;
    }
    byName.set(name, row);

    if (typeof row.owner !== 'string' || !row.owner.trim()) errors.push(`owner missing: ${name}`);
    if (typeof row.purpose !== 'string' || !row.purpose.trim()) errors.push(`purpose missing: ${name}`);
    if (typeof row.defaultRationale !== 'string' || !row.defaultRationale.trim()) errors.push(`defaultRationale missing: ${name}`);
    if (typeof row.defaultValue !== 'boolean') errors.push(`defaultValue must be boolean: ${name}`);
    if (!isIsoDate(row.reviewBy)) errors.push(`reviewBy invalid (YYYY-MM-DD): ${name}`);
    if (typeof row.blastRadius !== 'string' || !row.blastRadius.trim()) errors.push(`blastRadius missing: ${name}`);
    if (!Array.isArray(row.sourceRefs) || row.sourceRefs.length === 0) warnings.push(`sourceRefs empty: ${name}`);
  });

  sourceFlags.forEach((name) => {
    if (!byName.has(name)) errors.push(`missing registry entry: ${name}`);
  });
  byName.forEach((_row, name) => {
    if (!sourceFlags.includes(name)) errors.push(`orphan registry entry (not found in src): ${name}`);
  });

  if (!fs.existsSync(DOC_PATH)) {
    errors.push(`governance doc missing: ${DOC_PATH}`);
  } else {
    const doc = fs.readFileSync(DOC_PATH, 'utf8');
    sourceFlags.forEach((name) => {
      if (!doc.includes(name)) errors.push(`doc drift (flag missing in doc): ${name}`);
    });
  }

  if (errors.length) {
    console.error('[feature-flags] governance check failed');
    errors.forEach((err) => console.error(`- ${err}`));
    process.exit(1);
  }

  warnings.forEach((line) => console.warn(`[feature-flags] warning: ${line}`));
  console.log('[feature-flags] governance check passed');
  console.log(`[feature-flags] sourceFlags=${sourceFlags.length} registryFlags=${rows.length}`);
}

run();
