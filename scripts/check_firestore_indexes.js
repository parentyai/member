'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_REQUIRED_PATH = path.join(ROOT, 'docs', 'REPO_AUDIT_INPUTS', 'firestore_required_indexes.json');

function toPosix(value) {
  return String(value || '').replace(/\\/g, '/');
}

function readArgValue(argv, index, label) {
  if (index >= argv.length) throw new Error(`${label} value required`);
  return argv[index];
}

function parseArgs(argv, env) {
  const sourceEnv = env || process.env;
  const opts = {
    check: false,
    plan: false,
    contractsOnly: false,
    projectId: (sourceEnv.FIRESTORE_PROJECT_ID || sourceEnv.GCP_PROJECT_ID || '').trim(),
    requiredFile: DEFAULT_REQUIRED_PATH
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--check') {
      opts.check = true;
      continue;
    }
    if (arg === '--plan') {
      opts.plan = true;
      continue;
    }
    if (arg === '--contracts-only') {
      opts.contractsOnly = true;
      continue;
    }
    if (arg === '--project-id') {
      opts.projectId = readArgValue(argv, ++i, '--project-id').trim();
      continue;
    }
    if (arg === '--required-file') {
      const filePath = readArgValue(argv, ++i, '--required-file');
      opts.requiredFile = path.resolve(ROOT, filePath);
      continue;
    }
    throw new Error(`unknown option: ${arg}`);
  }

  return opts;
}

function normalizeOrder(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === 'ASCENDING' || normalized === 'DESCENDING') return normalized;
  return null;
}

function normalizeArrayConfig(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === 'CONTAINS') return normalized;
  return null;
}

function normalizeField(field) {
  const payload = field && typeof field === 'object' ? field : {};
  const fieldPath = typeof payload.fieldPath === 'string' ? payload.fieldPath.trim() : '';
  if (!fieldPath || fieldPath === '__name__') return null;
  const order = normalizeOrder(payload.order);
  const arrayConfig = normalizeArrayConfig(payload.arrayConfig);
  if (!order && !arrayConfig) {
    throw new Error(`invalid field config for ${fieldPath}: order/arrayConfig required`);
  }
  return {
    fieldPath,
    order: order || null,
    arrayConfig: arrayConfig || null
  };
}

function normalizeQueryScope(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return 'COLLECTION';
  return value.trim().toUpperCase();
}

function normalizeRequiredIndex(raw) {
  const payload = raw && typeof raw === 'object' ? raw : {};
  const id = typeof payload.id === 'string' ? payload.id.trim() : '';
  const collectionGroup = typeof payload.collectionGroup === 'string' ? payload.collectionGroup.trim() : '';
  if (!id) throw new Error('required index id is missing');
  if (!collectionGroup) throw new Error(`required index ${id} missing collectionGroup`);
  const fields = Array.isArray(payload.fields) ? payload.fields.map(normalizeField).filter(Boolean) : [];
  if (!fields.length) throw new Error(`required index ${id} has no valid fields`);
  return {
    id,
    collectionGroup,
    queryScope: normalizeQueryScope(payload.queryScope),
    fields
  };
}

function normalizeSourceEvidenceEntry(raw, label) {
  const payload = raw && typeof raw === 'object' ? raw : {};
  const evidencePath = typeof payload.path === 'string' ? payload.path.trim() : '';
  const line = Number(payload.line);
  if (!evidencePath) throw new Error(`${label} sourceEvidence.path is required`);
  if (!Number.isInteger(line) || line <= 0) throw new Error(`${label} sourceEvidence.line must be a positive integer`);
  return {
    path: evidencePath,
    line
  };
}

function normalizeCriticalContract(raw) {
  const payload = raw && typeof raw === 'object' ? raw : {};
  const contractId = typeof payload.contractId === 'string' ? payload.contractId.trim() : '';
  const routeOrUsecase = typeof payload.routeOrUsecase === 'string' ? payload.routeOrUsecase.trim() : '';
  if (!contractId) throw new Error('critical contract contractId is required');
  if (!routeOrUsecase) throw new Error(`critical contract ${contractId} missing routeOrUsecase`);
  const requiredIndexIds = Array.isArray(payload.requiredIndexIds)
    ? payload.requiredIndexIds
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
    : [];
  if (!requiredIndexIds.length) throw new Error(`critical contract ${contractId} missing requiredIndexIds`);
  const sourceEvidence = Array.isArray(payload.sourceEvidence)
    ? payload.sourceEvidence.map((item) => normalizeSourceEvidenceEntry(item, `critical contract ${contractId}`))
    : [];
  if (!sourceEvidence.length) throw new Error(`critical contract ${contractId} missing sourceEvidence`);
  return {
    contractId,
    routeOrUsecase,
    requiredIndexIds,
    sourceEvidence
  };
}

function resolveEvidencePath(rawPath) {
  const normalized = toPosix(rawPath);
  if (!normalized) return '';

  const direct = path.isAbsolute(normalized) ? normalized : path.resolve(ROOT, normalized);
  if (fs.existsSync(direct)) return direct;

  const marker = '/Projects/Member/';
  const markerIdx = normalized.indexOf(marker);
  if (markerIdx !== -1) {
    const relative = normalized.slice(markerIdx + marker.length);
    const remapped = path.join(ROOT, relative);
    if (fs.existsSync(remapped)) return remapped;
  }

  const match = normalized.match(/(?:^|\/)Member\/(.+)$/);
  if (match && match[1]) {
    const remapped = path.join(ROOT, match[1]);
    if (fs.existsSync(remapped)) return remapped;
  }

  return '';
}

function parseCollectionGroupFromName(name) {
  if (typeof name !== 'string') return '';
  const marker = '/collectionGroups/';
  const indexesMarker = '/indexes/';
  const start = name.indexOf(marker);
  if (start === -1) return '';
  const from = start + marker.length;
  const end = name.indexOf(indexesMarker, from);
  if (end === -1) return '';
  return name.slice(from, end);
}

function normalizeActualIndex(raw) {
  const payload = raw && typeof raw === 'object' ? raw : {};
  const collectionGroup = parseCollectionGroupFromName(payload.name) || '';
  if (!collectionGroup) return null;
  const queryScope = normalizeQueryScope(payload.queryScope);
  const fields = Array.isArray(payload.fields) ? payload.fields.map(normalizeField).filter(Boolean) : [];
  if (!fields.length) return null;
  return {
    name: typeof payload.name === 'string' ? payload.name : '',
    state: typeof payload.state === 'string' ? payload.state : 'UNKNOWN',
    collectionGroup,
    queryScope,
    fields
  };
}

function createFieldSignature(field) {
  if (field.order) return `${field.fieldPath}:order=${field.order}`;
  return `${field.fieldPath}:arrayConfig=${field.arrayConfig}`;
}

function createIndexSignature(index) {
  const fields = Array.isArray(index && index.fields) ? index.fields : [];
  return [
    String(index && index.collectionGroup ? index.collectionGroup : ''),
    String(index && index.queryScope ? index.queryScope : 'COLLECTION'),
    fields.map(createFieldSignature).join('|')
  ].join('::');
}

function diffIndexes(requiredIndexes, actualIndexes) {
  const required = Array.isArray(requiredIndexes) ? requiredIndexes : [];
  const actual = Array.isArray(actualIndexes) ? actualIndexes : [];
  const requiredBySignature = new Map();
  required.forEach((item) => {
    requiredBySignature.set(createIndexSignature(item), item);
  });
  const actualBySignature = new Map();
  actual.forEach((item) => {
    actualBySignature.set(createIndexSignature(item), item);
  });

  const missing = [];
  const present = [];
  required.forEach((item) => {
    const signature = createIndexSignature(item);
    const match = actualBySignature.get(signature);
    if (!match) {
      missing.push(item);
      return;
    }
    present.push({
      required: item,
      actual: match
    });
  });

  const extra = [];
  actual.forEach((item) => {
    const signature = createIndexSignature(item);
    if (!requiredBySignature.has(signature)) extra.push(item);
  });

  return { missing, extra, present };
}

function buildCreateCommand(projectId, spec) {
  const args = [
    'gcloud firestore indexes composite create',
    `--project \"${projectId}\"`,
    `--collection-group=\"${spec.collectionGroup}\"`,
    `--query-scope=\"${spec.queryScope}\"`
  ];
  spec.fields.forEach((field) => {
    if (field.order) {
      args.push(`--field-config=\"field-path=${field.fieldPath},order=${field.order.toLowerCase()}\"`);
      return;
    }
    args.push(`--field-config=\"field-path=${field.fieldPath},array-config=${field.arrayConfig.toLowerCase()}\"`);
  });
  return args.join(' ');
}

function readRequiredPayload(requiredFile) {
  if (!fs.existsSync(requiredFile)) {
    throw new Error(`required file not found: ${toPosix(path.relative(ROOT, requiredFile))}`);
  }
  const raw = fs.readFileSync(requiredFile, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_err) {
    throw new Error(`required file is invalid JSON: ${toPosix(path.relative(ROOT, requiredFile))}`);
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('required file payload must be an object');
  const list = Array.isArray(parsed.indexes) ? parsed.indexes : [];
  if (!list.length) throw new Error('required index list is empty');
  const contracts = Array.isArray(parsed.criticalContracts) ? parsed.criticalContracts : [];
  return {
    indexes: list.map(normalizeRequiredIndex),
    criticalContracts: contracts.map(normalizeCriticalContract)
  };
}

function readRequiredDefinition(requiredFile) {
  return readRequiredPayload(requiredFile).indexes;
}

function validateCriticalContracts(requiredIndexes, criticalContracts) {
  const contracts = Array.isArray(criticalContracts) ? criticalContracts : [];
  const idSet = new Set((Array.isArray(requiredIndexes) ? requiredIndexes : []).map((item) => item.id));
  const errors = [];

  contracts.forEach((contract) => {
    (contract.requiredIndexIds || []).forEach((id) => {
      if (!idSet.has(id)) {
        errors.push(`criticalContracts.${contract.contractId} references unknown index id: ${id}`);
      }
    });
    (contract.sourceEvidence || []).forEach((evidence) => {
      const resolvedPath = resolveEvidencePath(evidence.path);
      if (!resolvedPath) {
        errors.push(`criticalContracts.${contract.contractId} sourceEvidence.path not found: ${evidence.path}`);
      }
    });
  });

  return errors;
}

function getGcloudProjectFallback(execFileSyncFn) {
  try {
    const value = execFileSyncFn('gcloud', ['config', 'get-value', 'project'], { encoding: 'utf8' })
      .toString()
      .trim();
    if (!value || value === '(unset)') return '';
    return value;
  } catch (_err) {
    return '';
  }
}

function resolveProjectId(opts, execFileSyncFn) {
  if (opts.projectId) return opts.projectId;
  const fallback = getGcloudProjectFallback(execFileSyncFn);
  if (fallback) return fallback;
  throw new Error('project id required (--project-id or FIRESTORE_PROJECT_ID/GCP_PROJECT_ID)');
}

function listActualIndexes(projectId, execFileSyncFn) {
  let out = '';
  try {
    out = execFileSyncFn('gcloud', [
      'firestore',
      'indexes',
      'composite',
      'list',
      '--project',
      projectId,
      '--format=json'
    ], { encoding: 'utf8' });
  } catch (err) {
    const message = err && err.message ? String(err.message) : String(err);
    throw new Error(`gcloud firestore indexes composite list failed: ${message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(String(out || '[]'));
  } catch (_err) {
    throw new Error('gcloud index list output is not valid JSON');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('gcloud index list output must be an array');
  }
  return parsed.map(normalizeActualIndex).filter(Boolean);
}

function printDiffSummary(projectId, requiredFile, requiredIndexes, actualIndexes, diff) {
  const rel = toPosix(path.relative(ROOT, requiredFile));
  process.stdout.write(`[firestore-indexes] project=${projectId}\n`);
  process.stdout.write(`[firestore-indexes] required_file=${rel}\n`);
  process.stdout.write(
    `[firestore-indexes] required=${requiredIndexes.length} actual=${actualIndexes.length} present=${diff.present.length} missing=${diff.missing.length} extra=${diff.extra.length}\n`
  );

  if (diff.missing.length > 0) {
    process.stdout.write('不足 index:\n');
    diff.missing.forEach((item) => {
      process.stdout.write(`- ${item.id} (${item.collectionGroup})\n`);
    });
  }
  if (diff.extra.length > 0) {
    process.stdout.write('余剰 index（required定義外）:\n');
    diff.extra.forEach((item) => {
      process.stdout.write(`- ${item.collectionGroup} (${item.name || 'unknown'})\n`);
    });
  }
}

function printCreatePlan(projectId, missing) {
  process.stdout.write('create plan:\n');
  if (!missing.length) {
    process.stdout.write('- 追加作成は不要です。\n');
    return;
  }
  missing.forEach((item) => {
    process.stdout.write(`${buildCreateCommand(projectId, item)}\n`);
  });
}

function printContractErrors(errors) {
  if (!Array.isArray(errors) || errors.length === 0) return;
  process.stdout.write('critical contract validation errors:\n');
  errors.forEach((item) => {
    process.stdout.write(`- ${item}\n`);
  });
}

function run(argv, env, execFileSyncFn) {
  const opts = parseArgs(argv || process.argv, env || process.env);
  const execSync = execFileSyncFn || childProcess.execFileSync;
  const requiredPayload = readRequiredPayload(opts.requiredFile);
  const required = requiredPayload.indexes;
  const criticalContracts = requiredPayload.criticalContracts;
  const contractErrors = validateCriticalContracts(required, criticalContracts);
  const contractsOnly = Boolean(opts.contractsOnly);

  let projectId = '';
  let actual = [];
  let diff = {
    missing: [],
    extra: [],
    present: []
  };

  if (contractsOnly) {
    process.stdout.write(`[firestore-indexes] contracts-only mode enabled\n`);
  } else {
    projectId = resolveProjectId(opts, execSync);
    actual = listActualIndexes(projectId, execSync);
    diff = diffIndexes(required, actual);
    printDiffSummary(projectId, opts.requiredFile, required, actual, diff);
    if (opts.plan) printCreatePlan(projectId, diff.missing);
  }
  printContractErrors(contractErrors);

  if (opts.check && (contractErrors.length > 0 || (!contractsOnly && diff.missing.length > 0))) {
    if (!contractsOnly && diff.missing.length > 0) {
      process.stderr.write(`不足 index が ${diff.missing.length} 件あります。上記 create plan を実行してください。\n`);
    }
    if (contractErrors.length > 0) {
      process.stderr.write(`critical contract エラーが ${contractErrors.length} 件あります。required index 定義を修正してください。\n`);
    }
    return 1;
  }
  return 0;
}

if (require.main === module) {
  try {
    const code = run(process.argv, process.env, childProcess.execFileSync);
    process.exit(code);
  } catch (err) {
    process.stderr.write(`${err && err.message ? err.message : err}\n`);
    process.exit(1);
  }
}

module.exports = {
  DEFAULT_REQUIRED_PATH,
  parseArgs,
  normalizeField,
  normalizeRequiredIndex,
  normalizeCriticalContract,
  normalizeActualIndex,
  createIndexSignature,
  diffIndexes,
  buildCreateCommand,
  readRequiredPayload,
  readRequiredDefinition,
  validateCriticalContracts,
  resolveEvidencePath,
  resolveProjectId,
  listActualIndexes,
  run
};
