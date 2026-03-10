'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_REGISTRY_PATH = path.join(ROOT, 'contracts', 'llm_spec_contract_registry.v2.json');

const ALLOWED_STATUSES = new Set([
  'aligned',
  'partial',
  'conflict',
  'missing',
  'repo-leads-spec',
  'spec-leads-repo'
]);

function parseArgs(argv) {
  const opts = {
    registry: DEFAULT_REGISTRY_PATH,
    check: false
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--registry' && argv[i + 1]) {
      opts.registry = path.resolve(ROOT, argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--check') {
      opts.check = true;
    }
  }
  return opts;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function parseEvidencePath(value) {
  const source = String(value || '').trim();
  if (!source) return null;
  const hashIndex = source.indexOf('#L');
  if (hashIndex >= 0) {
    return source.slice(0, hashIndex);
  }
  const match = source.match(/^(.*?):(\d+)(?::\d+)?$/);
  if (match && match[1]) return match[1];
  return source;
}

function validateRegistry(registry) {
  const errors = [];
  const warnings = [];
  if (!registry || typeof registry !== 'object') {
    errors.push('registry must be an object');
    return { errors, warnings };
  }

  if (!registry.registryVersion || typeof registry.registryVersion !== 'string') {
    errors.push('registryVersion is required');
  }
  if (!registry.registryHash || typeof registry.registryHash !== 'string') {
    errors.push('registryHash is required');
  }
  if (!Array.isArray(registry.authorityOrder) || registry.authorityOrder.length < 3) {
    errors.push('authorityOrder must include at least 3 entries');
  }
  if (!Array.isArray(registry.specHierarchy) || registry.specHierarchy.length < 3) {
    errors.push('specHierarchy must include at least 3 entries');
  } else {
    registry.specHierarchy.forEach((row, idx) => {
      if (!row || typeof row !== 'object') {
        errors.push(`specHierarchy[${idx}] must be object`);
        return;
      }
      if (!row.id || typeof row.id !== 'string') {
        errors.push(`specHierarchy[${idx}].id is required`);
      }
      if (!row.path || typeof row.path !== 'string') {
        errors.push(`specHierarchy[${idx}].path is required`);
      } else if (!fs.existsSync(row.path)) {
        warnings.push(`specHierarchy[${idx}] path missing locally: ${row.path}`);
      }
      if (typeof row.required !== 'boolean') {
        errors.push(`specHierarchy[${idx}].required must be boolean`);
      }
    });
  }

  if (!Array.isArray(registry.requirements) || registry.requirements.length === 0) {
    errors.push('requirements must include at least one row');
  } else {
    registry.requirements.forEach((row, idx) => {
      if (!row || typeof row !== 'object') {
        errors.push(`requirements[${idx}] must be object`);
        return;
      }
      if (!row.requirementId || typeof row.requirementId !== 'string') {
        errors.push(`requirements[${idx}].requirementId is required`);
      }
      if (!row.sourceSpec || typeof row.sourceSpec !== 'string') {
        errors.push(`requirements[${idx}].sourceSpec is required`);
      }
      if (!row.summary || typeof row.summary !== 'string') {
        errors.push(`requirements[${idx}].summary is required`);
      }
      if (!row.status || !ALLOWED_STATUSES.has(row.status)) {
        errors.push(`requirements[${idx}].status must be one of ${Array.from(ALLOWED_STATUSES).join(', ')}`);
      }
      if (!row.severity || typeof row.severity !== 'string') {
        errors.push(`requirements[${idx}].severity is required`);
      }
      if (!row.recommendedAction || typeof row.recommendedAction !== 'string') {
        errors.push(`requirements[${idx}].recommendedAction is required`);
      }
      if (!Array.isArray(row.evidence) || row.evidence.length === 0) {
        errors.push(`requirements[${idx}].evidence is required`);
      } else {
        row.evidence.forEach((item, evidenceIdx) => {
          const filePath = parseEvidencePath(item);
          if (!filePath) {
            errors.push(`requirements[${idx}].evidence[${evidenceIdx}] invalid path`);
            return;
          }
          if (!fs.existsSync(filePath)) {
            warnings.push(`requirements[${idx}] evidence path missing locally: ${filePath}`);
          }
        });
      }
    });
  }

  if (!Array.isArray(registry.conflicts)) {
    errors.push('conflicts must be an array');
  } else {
    registry.conflicts.forEach((row, idx) => {
      if (!row || typeof row !== 'object') {
        errors.push(`conflicts[${idx}] must be object`);
        return;
      }
      if (!row.conflictId || typeof row.conflictId !== 'string') {
        errors.push(`conflicts[${idx}].conflictId is required`);
      }
      if (typeof row.blocking !== 'boolean') {
        errors.push(`conflicts[${idx}].blocking must be boolean`);
      }
    });
  }

  return { errors, warnings };
}

function summarize(registry) {
  const requirements = Array.isArray(registry.requirements) ? registry.requirements : [];
  const conflicts = Array.isArray(registry.conflicts) ? registry.conflicts : [];
  const statusCounts = requirements.reduce((acc, row) => {
    const key = row && typeof row.status === 'string' ? row.status : 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return {
    registryVersion: registry.registryVersion || null,
    registryHash: registry.registryHash || null,
    requirementCount: requirements.length,
    statusCounts,
    blockingConflictCount: conflicts.filter((row) => row && row.blocking === true).length
  };
}

function main() {
  const opts = parseArgs(process.argv);
  if (!fs.existsSync(opts.registry)) {
    process.stderr.write(`[llm_spec_contract_freeze] registry not found: ${opts.registry}\n`);
    process.exit(1);
  }

  const registry = readJson(opts.registry);
  const check = validateRegistry(registry);
  const summary = summarize(registry);
  const output = {
    ok: check.errors.length === 0,
    registryPath: opts.registry,
    summary,
    warnings: check.warnings
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

  if (opts.check && check.warnings.length > 0) {
    process.stderr.write('[llm_spec_contract_freeze] warnings detected\n');
    check.warnings.forEach((item) => process.stderr.write(`- ${item}\n`));
  }
  if (check.errors.length > 0) {
    process.stderr.write('[llm_spec_contract_freeze] validation errors\n');
    check.errors.forEach((item) => process.stderr.write(`- ${item}\n`));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  parseEvidencePath,
  validateRegistry,
  summarize
};
