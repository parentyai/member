'use strict';

const path = require('path');
const fs = require('fs');
const {
  ROOT,
  KG_DIR,
  AUDIT_INPUT_DIR,
  toPosix,
  ensureDir,
  readText,
  readJson,
  writeJson,
  listFilesRecursive,
  getGitMeta,
  findLineNumber,
  normalizeEvidence,
  toEntityName
} = require('./knowledge_graph_common');

const OUTPUT_DATA_PATH = path.join(KG_DIR, 'project_knowledge_graph_data.json');
const RUNTIME_PROBE_PATH = path.join(KG_DIR, 'runtime_probe.json');
const PKG_PATH = path.join(ROOT, 'package.json');

const INPUT_PATHS = Object.freeze({
  featureMap: path.join(AUDIT_INPUT_DIR, 'feature_map.json'),
  dependencyGraph: path.join(AUDIT_INPUT_DIR, 'dependency_graph.json'),
  dataModelMap: path.join(AUDIT_INPUT_DIR, 'data_model_map.json'),
  dataLifecycle: path.join(AUDIT_INPUT_DIR, 'data_lifecycle.json'),
  stateTransitions: path.join(AUDIT_INPUT_DIR, 'state_transitions.json'),
  protectionMatrix: path.join(AUDIT_INPUT_DIR, 'protection_matrix.json'),
  authFlow: path.join(AUDIT_INPUT_DIR, 'auth_flow.json'),
  notificationFlow: path.join(AUDIT_INPUT_DIR, 'notification_flow.json'),
  llmInputBoundaries: path.join(AUDIT_INPUT_DIR, 'llm_input_boundaries.json'),
  killSwitchPoints: path.join(AUDIT_INPUT_DIR, 'kill_switch_points.json'),
  auditInputsManifest: path.join(AUDIT_INPUT_DIR, 'audit_inputs_manifest.json')
});

const SRC_DIR = path.join(ROOT, 'src');
const ROUTES_DIR = path.join(SRC_DIR, 'routes');
const USECASES_DIR = path.join(SRC_DIR, 'usecases');
const REPOS_DIR = path.join(SRC_DIR, 'repos', 'firestore');
const ADMIN_APP_DIR = path.join(ROOT, 'apps', 'admin');
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');

const JS_KEYWORDS = new Set([
  'if',
  'else',
  'for',
  'while',
  'switch',
  'case',
  'default',
  'return',
  'const',
  'let',
  'var',
  'function',
  'async',
  'await',
  'new',
  'throw',
  'catch',
  'try',
  'break',
  'continue',
  'typeof'
]);

function rel(absPath) {
  return toPosix(path.relative(ROOT, absPath));
}

function pathLine(relPath, token) {
  const absolute = path.join(ROOT, relPath);
  const line = findLineNumber(absolute, token || '');
  return `${toPosix(relPath)}:${line}`;
}

function inputPathLine(key, token) {
  const p = INPUT_PATHS[key];
  const line = findLineNumber(p, token || '');
  return `${rel(p)}:${line}`;
}

function stringifyArray(values) {
  return (Array.isArray(values) ? values : [])
    .map((v) => String(v || '').trim())
    .filter(Boolean);
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function guessFieldType(expression, fieldName) {
  const text = String(expression || '');
  const loweredField = String(fieldName || '').toLowerCase();
  if (/true|false|Boolean|normalizeBoolean/.test(text)) return 'boolean';
  if (/Date|toISOString|Timestamp|toMillis|Date\.now/.test(text) || loweredField.endsWith('at') || loweredField.endsWith('time')) return 'datetime';
  if (/Number|parseInt|parseFloat|Math\.|count|score|ratio|days|hours|minutes|amount|total|limit/i.test(text)) return 'number';
  if (/\[|\]|\bArray\b|Array\.isArray|\.map\(|\.filter\(|\.flatMap\(/.test(text)) return 'array';
  if (/\{|\}|\bObject\b/.test(text)) return 'object';
  if (/normalizeString|trim|toLowerCase|toUpperCase|String|id|name|url|status|type|reason|traceId/i.test(text) || loweredField.includes('id')) {
    return 'string';
  }
  return 'unknown';
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function detectRequired(text, fieldName) {
  const escaped = escapeRegex(fieldName);
  const patterns = [
    new RegExp(`!payload\\.${escaped}\\b`),
    new RegExp(`throw new Error\\(['"\`]${escaped}\\s+required`),
    new RegExp(`missing\\s+${escaped}\\b`, 'i')
  ];
  return patterns.some((re) => re.test(text));
}

function extractFieldsFromRepoFile(relFilePath) {
  const absPath = path.join(ROOT, relFilePath);
  if (!fs.existsSync(absPath)) return [];
  const text = readText(absPath);
  const fields = [];

  const addField = (field, type, required, tokenHint, context) => {
    if (!field || JS_KEYWORDS.has(field)) return;
    const source = `${toPosix(relFilePath)}:${findLineNumber(absPath, tokenHint || field)}`;
    fields.push({
      field,
      type: type || 'unknown',
      required: required === true ? 'YES' : (required === false ? 'NO' : 'UNKNOWN'),
      source,
      context: context || 'unknown',
      evidence: normalizeEvidence([source])
    });
  };

  const writeObjectRe = /\.(set|update|create|add)\s*\(\s*\{([\s\S]{0,2000}?)\}\s*(?:,|\))/g;
  let writeMatch = writeObjectRe.exec(text);
  while (writeMatch) {
    const body = writeMatch[2] || '';
    const pairRe = /([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^,\n}]+)/g;
    let pair = pairRe.exec(body);
    while (pair) {
      const field = pair[1];
      const expr = pair[2];
      const required = detectRequired(text, field);
      addField(field, guessFieldType(expr, field), required, `${field}:`, 'write');
      pair = pairRe.exec(body);
    }
    writeMatch = writeObjectRe.exec(text);
  }

  const queryFieldRe = /\.(where|orderBy|select)\(\s*['"]([^'"]+)['"]/g;
  let queryMatch = queryFieldRe.exec(text);
  while (queryMatch) {
    const field = queryMatch[2];
    addField(field, 'unknown', null, `'${field}'`, 'read_query');
    queryMatch = queryFieldRe.exec(text);
  }

  return uniqueBy(fields, (row) => `${row.field}|${row.source}`);
}

function loadInputs() {
  return {
    featureMap: readJson(INPUT_PATHS.featureMap, { features: [] }),
    dependencyGraph: readJson(INPUT_PATHS.dependencyGraph, {}),
    dataModelMap: readJson(INPUT_PATHS.dataModelMap, { collections: [] }),
    dataLifecycle: readJson(INPUT_PATHS.dataLifecycle, []),
    stateTransitions: readJson(INPUT_PATHS.stateTransitions, {}),
    protectionMatrix: readJson(INPUT_PATHS.protectionMatrix, {}),
    authFlow: readJson(INPUT_PATHS.authFlow, {}),
    notificationFlow: readJson(INPUT_PATHS.notificationFlow, {}),
    llmInputBoundaries: readJson(INPUT_PATHS.llmInputBoundaries, {}),
    killSwitchPoints: readJson(INPUT_PATHS.killSwitchPoints, {}),
    auditInputsManifest: readJson(INPUT_PATHS.auditInputsManifest, {})
  };
}

function loadRuntimeProbe() {
  if (!fs.existsSync(RUNTIME_PROBE_PATH)) {
    return {
      generatedAt: null,
      cloudRun: {
        observed: false,
        status: 'UNOBSERVED_RUNTIME',
        serviceCount: 0,
        services: [],
        evidence: 'runtime:gcloud run services list@UNOBSERVED_RUNTIME',
        reason: 'runtime probe not generated'
      },
      secretManager: {
        observed: false,
        status: 'UNOBSERVED_RUNTIME',
        secretCount: 0,
        secretNames: [],
        evidence: 'runtime:gcloud secrets list@UNOBSERVED_RUNTIME',
        reason: 'runtime probe not generated'
      },
      firestore: {
        observed: false,
        status: 'UNOBSERVED_RUNTIME',
        collectionCount: 0,
        collections: [],
        evidence: 'runtime:firebase-admin firestore listCollections@UNOBSERVED_RUNTIME',
        reason: 'runtime probe not generated'
      }
    };
  }
  return readJson(RUNTIME_PROBE_PATH, {});
}

function buildLifecycleMap(dataLifecycle) {
  const map = new Map();
  for (const row of Array.isArray(dataLifecycle) ? dataLifecycle : []) {
    if (!row || !row.collection) continue;
    map.set(row.collection, row);
  }
  return map;
}

function buildRepoToCollectionMap(dataModelMap) {
  const repoToCollections = new Map();
  const collectionToModel = new Map();
  const rows = Array.isArray(dataModelMap && dataModelMap.collections) ? dataModelMap.collections : [];
  for (const row of rows) {
    if (!row || !row.collection) continue;
    collectionToModel.set(row.collection, row);
    for (const repo of stringifyArray(row.repos)) {
      if (!repoToCollections.has(repo)) repoToCollections.set(repo, new Set());
      repoToCollections.get(repo).add(row.collection);
    }
  }
  return { repoToCollections, collectionToModel };
}

function buildFeatureByCollectionMap(featureMap) {
  const map = new Map();
  const rows = Array.isArray(featureMap && featureMap.features) ? featureMap.features : [];
  for (const feature of rows) {
    const name = feature && feature.feature ? feature.feature : null;
    if (!name) continue;
    for (const collection of stringifyArray(feature.collections)) {
      if (!map.has(collection)) map.set(collection, new Set());
      map.get(collection).add(name);
    }
  }
  return map;
}

function buildProjectScope(inputs, runtime) {
  const routeFiles = listFilesRecursive(ROUTES_DIR, (p) => p.endsWith('.js'));
  const usecaseFiles = listFilesRecursive(USECASES_DIR, (p) => p.endsWith('.js'));
  const repoFiles = listFilesRecursive(REPOS_DIR, (p) => p.endsWith('.js'));
  const adminFiles = listFilesRecursive(ADMIN_APP_DIR, (p) => /\.(html|js|css)$/.test(p));
  const workflowFiles = listFilesRecursive(WORKFLOWS_DIR, (p) => /\.(yml|yaml)$/.test(p));
  const dataModelRows = Array.isArray(inputs.dataModelMap && inputs.dataModelMap.collections)
    ? inputs.dataModelMap.collections
    : [];

  const rows = [
    {
      layer: 'UI',
      component: `Admin UI (${adminFiles.length} files)`,
      location: 'apps/admin/app.html, apps/admin/assets/admin_app.js',
      evidence: normalizeEvidence([
        'apps/admin/app.html:1',
        'apps/admin/assets/admin_app.js:1'
      ])
    },
    {
      layer: 'API',
      component: `Express route surface (${routeFiles.length} route files)`,
      location: 'src/index.js, src/routes/*',
      evidence: normalizeEvidence([
        'src/index.js:1',
        inputPathLine('protectionMatrix', '"protection_matrix"')
      ])
    },
    {
      layer: 'Usecase',
      component: `Domain usecases (${usecaseFiles.length} files)`,
      location: 'src/usecases/*',
      evidence: normalizeEvidence([
        'src/usecases/journey/runJourneyTodoReminderJob.js:1',
        inputPathLine('dependencyGraph', '"usecase_to_repo"')
      ])
    },
    {
      layer: 'Repository',
      component: `Firestore repositories (${repoFiles.length} files)`,
      location: 'src/repos/firestore/*',
      evidence: normalizeEvidence([
        'src/repos/firestore/auditLogsRepo.js:1',
        inputPathLine('dataModelMap', '"collections"')
      ])
    },
    {
      layer: 'Firestore',
      component: `Collections (${dataModelRows.length})`,
      location: 'docs/REPO_AUDIT_INPUTS/data_model_map.json',
      evidence: normalizeEvidence([
        inputPathLine('dataModelMap', '"collections"'),
        inputPathLine('dataLifecycle', '"collection"')
      ])
    },
    {
      layer: 'Jobs',
      component: `Schedulers and internal jobs (${workflowFiles.length} workflows)`,
      location: '.github/workflows/*.yml, src/routes/internal/*, src/usecases/**/run*Job.js',
      evidence: normalizeEvidence([
        '.github/workflows/journey-todo-reminder.yml:1',
        'src/routes/internal/journeyTodoReminderJob.js:1',
        'src/usecases/journey/runJourneyTodoReminderJob.js:1'
      ])
    },
    {
      layer: 'LLM',
      component: 'Input boundary and adapter pipeline',
      location: 'src/usecases/llm/*, src/infra/llmClient.js, docs/REPO_AUDIT_INPUTS/llm_input_boundaries.json',
      evidence: normalizeEvidence([
        'src/infra/llmClient.js:1',
        inputPathLine('llmInputBoundaries', '"llm_input_boundaries"')
      ])
    },
    {
      layer: 'Evidence',
      component: 'Audit and trace reconstruction surface',
      location: 'src/repos/firestore/auditLogsRepo.js, src/repos/firestore/decisionTimelineRepo.js, docs/REPO_AUDIT_INPUTS/*',
      evidence: normalizeEvidence([
        'src/repos/firestore/auditLogsRepo.js:1',
        'src/repos/firestore/decisionTimelineRepo.js:1',
        inputPathLine('auditInputsManifest', '"sourceDigest"')
      ])
    },
    {
      layer: 'Infra',
      component: `Cloud Run/Secrets/Firestore runtime probe (${runtime && runtime.cloudRun ? runtime.cloudRun.status : 'UNOBSERVED_RUNTIME'})`,
      location: 'runtime:gcloud run services list, runtime:gcloud secrets list, runtime:firebase-admin firestore listCollections',
      evidence: normalizeEvidence([
        runtime && runtime.cloudRun && runtime.cloudRun.evidence ? runtime.cloudRun.evidence : 'runtime:gcloud run services list@UNOBSERVED_RUNTIME',
        runtime && runtime.secretManager && runtime.secretManager.evidence ? runtime.secretManager.evidence : 'runtime:gcloud secrets list@UNOBSERVED_RUNTIME',
        runtime && runtime.firestore && runtime.firestore.evidence ? runtime.firestore.evidence : 'runtime:firebase-admin firestore listCollections@UNOBSERVED_RUNTIME'
      ])
    }
  ];

  return rows;
}

function buildEntityInventory(inputs, lifecycleMap, featureByCollection, runtime) {
  const rows = [];
  const modelRows = Array.isArray(inputs.dataModelMap && inputs.dataModelMap.collections)
    ? inputs.dataModelMap.collections
    : [];

  for (const model of modelRows) {
    const collection = model && model.collection ? model.collection : null;
    if (!collection) continue;
    const lifecycle = lifecycleMap.get(collection);
    const writePath = stringifyArray(model.write_paths)[0] || stringifyArray(model.read_paths)[0] || 'UNOBSERVED_STATIC';
    const featureRefs = featureByCollection.has(collection)
      ? Array.from(featureByCollection.get(collection)).slice(0, 3).join(', ')
      : '';
    const purposeBase = lifecycle && lifecycle.kind ? lifecycle.kind : 'UNOBSERVED_STATIC';
    const purpose = featureRefs ? `${purposeBase} (${featureRefs})` : purposeBase;
    const evidence = normalizeEvidence([
      lifecycle && lifecycle.evidence ? lifecycle.evidence : null,
      writePath && writePath !== 'UNOBSERVED_STATIC' ? `${writePath}:1` : null,
      inputPathLine('dataModelMap', `"collection": "${collection}"`)
    ]);
    rows.push({
      entity: toEntityName(collection),
      storage: `Firestore:${collection}`,
      repoFile: writePath,
      purpose,
      evidence
    });
  }

  const runServices = runtime && runtime.cloudRun && Array.isArray(runtime.cloudRun.services)
    ? runtime.cloudRun.services
    : [];
  for (const service of runServices) {
    rows.push({
      entity: `CloudRunService${toEntityName(service.name)}`,
      storage: 'CloudRunService',
      repoFile: 'runtime:gcloud run services list',
      purpose: `runtime_service region=${service.region || 'unknown'}`,
      evidence: normalizeEvidence([runtime.cloudRun.evidence || 'runtime:gcloud run services list@UNOBSERVED_RUNTIME'])
    });
  }

  const secretNames = runtime && runtime.secretManager && Array.isArray(runtime.secretManager.secretNames)
    ? runtime.secretManager.secretNames
    : [];
  for (const secretName of secretNames) {
    rows.push({
      entity: `SecretRef${toEntityName(secretName)}`,
      storage: 'SecretManager',
      repoFile: 'runtime:gcloud secrets list',
      purpose: 'runtime_secret_name_only',
      evidence: normalizeEvidence([runtime.secretManager.evidence || 'runtime:gcloud secrets list@UNOBSERVED_RUNTIME'])
    });
  }

  if (runtime && runtime.firestore && runtime.firestore.status === 'UNOBSERVED_RUNTIME') {
    rows.push({
      entity: 'FirestoreRuntimeProbe',
      storage: 'FirestoreRuntime',
      repoFile: 'runtime:firebase-admin firestore listCollections',
      purpose: `UNOBSERVED_RUNTIME (${runtime.firestore.reason || 'reauth required'})`,
      evidence: normalizeEvidence([runtime.firestore.evidence || 'runtime:firebase-admin firestore listCollections@UNOBSERVED_RUNTIME'])
    });
  }

  return uniqueBy(rows, (row) => `${row.entity}|${row.storage}|${row.repoFile}`);
}

function buildEntitySchema(inputs, lifecycleMap) {
  const rows = [];
  const modelRows = Array.isArray(inputs.dataModelMap && inputs.dataModelMap.collections)
    ? inputs.dataModelMap.collections
    : [];

  for (const model of modelRows) {
    const collection = model && model.collection ? model.collection : null;
    if (!collection) continue;
    const entity = toEntityName(collection);
    const files = Array.from(new Set(
      stringifyArray(model.write_paths)
        .concat(stringifyArray(model.read_paths))
    ));

    const collected = [];
    for (const filePath of files) {
      const parsed = extractFieldsFromRepoFile(filePath);
      for (const fieldRow of parsed) {
        collected.push(fieldRow);
      }
    }

    const deduped = uniqueBy(collected, (row) => `${row.field}|${row.source}`);
    if (!deduped.length) {
      const fallbackEvidence = normalizeEvidence([
        inputPathLine('dataModelMap', `"collection": "${collection}"`),
        lifecycleMap.get(collection) && lifecycleMap.get(collection).evidence
          ? lifecycleMap.get(collection).evidence
          : null
      ]);
      rows.push({
        entity,
        field: 'UNRESOLVED_STATIC_ONLY',
        type: 'unknown',
        required: 'UNKNOWN',
        source: stringifyArray(model.write_paths)[0] || stringifyArray(model.read_paths)[0] || 'UNOBSERVED_STATIC',
        evidence: fallbackEvidence
      });
      continue;
    }

    for (const fieldRow of deduped) {
      rows.push({
        entity,
        field: fieldRow.field,
        type: fieldRow.type,
        required: fieldRow.required,
        source: fieldRow.source,
        evidence: fieldRow.evidence
      });
    }
  }

  return rows.sort((a, b) => {
    if (a.entity !== b.entity) return a.entity.localeCompare(b.entity);
    if (a.field !== b.field) return a.field.localeCompare(b.field);
    return a.source.localeCompare(b.source);
  });
}

function buildEntityRelations(inputs, repoToCollections) {
  const rows = [];
  const dep = inputs.dependencyGraph || {};
  const routeToUsecase = dep.route_to_usecase || {};
  const usecaseToRepo = dep.usecase_to_repo || {};
  const repoToCollection = dep.repo_to_collection || {};

  for (const routeFile of Object.keys(routeToUsecase)) {
    const usecases = stringifyArray(routeToUsecase[routeFile]);
    for (const usecase of usecases) {
      rows.push({
        from: `Route:${path.basename(routeFile, '.js')}`,
        to: `Usecase:${usecase}`,
        relation: 'invokes',
        evidence: normalizeEvidence([`${routeFile}:1`, inputPathLine('dependencyGraph', `"${routeFile}"`)])
      });
    }
  }

  for (const usecase of Object.keys(usecaseToRepo)) {
    const repos = stringifyArray(usecaseToRepo[usecase]);
    for (const repo of repos) {
      rows.push({
        from: `Usecase:${usecase}`,
        to: `Repo:${repo}`,
        relation: 'uses_repo',
        evidence: normalizeEvidence([inputPathLine('dependencyGraph', `"${usecase}"`)])
      });
    }
  }

  for (const repo of Object.keys(repoToCollection)) {
    const collections = stringifyArray(repoToCollection[repo]);
    for (const collection of collections) {
      rows.push({
        from: `Repo:${repo}`,
        to: `Entity:${toEntityName(collection)}`,
        relation: 'reads_writes_collection',
        evidence: normalizeEvidence([
          inputPathLine('dependencyGraph', `"${repo}"`),
          `src/repos/firestore/${repo}.js:1`
        ])
      });
    }
  }

  const transitions = inputs.stateTransitions || {};
  for (const entityName of Object.keys(transitions)) {
    const detail = transitions[entityName];
    const transitionRows = Array.isArray(detail && detail.transitions) ? detail.transitions : [];
    for (const transition of transitionRows) {
      const writes = String(transition && transition.collection_write ? transition.collection_write : '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      for (const collection of writes) {
        rows.push({
          from: `State:${entityName}.${transition.from || '*'}`,
          to: `Entity:${toEntityName(collection)}`,
          relation: `transition_write_to_${transition.to || 'unknown'}`,
          evidence: normalizeEvidence([
            transition.writer || null,
            inputPathLine('stateTransitions', `"${entityName}"`)
          ])
        });
      }
    }
  }

  const notificationFlow = inputs.notificationFlow || {};
  const notificationEntry = notificationFlow.entry || 'src/routes/admin/osNotifications.js';
  for (const usecase of stringifyArray(notificationFlow.usecases)) {
    rows.push({
      from: `Route:${path.basename(notificationEntry, '.js')}`,
      to: `Usecase:${usecase}`,
      relation: 'notification_pipeline_invokes',
      evidence: normalizeEvidence([
        `${notificationEntry}:1`,
        inputPathLine('notificationFlow', '"usecases"')
      ])
    });
  }
  for (const collection of stringifyArray(notificationFlow.writes)) {
    rows.push({
      from: 'Pipeline:Notification',
      to: `Entity:${toEntityName(collection)}`,
      relation: 'writes',
      evidence: normalizeEvidence([
        inputPathLine('notificationFlow', '"writes"'),
        'src/usecases/notifications/sendNotification.js:1'
      ])
    });
  }

  rows.push({
    from: 'Entity:CityPacks',
    to: 'Entity:SourceRefs',
    relation: 'references_vendor_sources',
    evidence: normalizeEvidence([
      'src/usecases/cityPack/runCityPackSourceAuditJob.js:71',
      'src/repos/firestore/sourceRefsRepo.js:1'
    ])
  });

  rows.push({
    from: 'Entity:LlmInputBoundary',
    to: 'Entity:LlmResponse',
    relation: 'llm_inference',
    evidence: normalizeEvidence([
      'src/usecases/llm/buildLlmInputView.js:1',
      'src/infra/llmClient.js:46'
    ])
  });

  rows.push({
    from: 'Entity:LlmResponse',
    to: 'Entity:FaqAnswerLogs',
    relation: 'persist_answer_trace',
    evidence: normalizeEvidence([
      inputPathLine('dependencyGraph', '"answerFaqFromKb"'),
      'src/repos/firestore/faqAnswerLogsRepo.js:1'
    ])
  });

  return uniqueBy(rows, (row) => `${row.from}|${row.to}|${row.relation}`).sort((a, b) => {
    if (a.from !== b.from) return a.from.localeCompare(b.from);
    if (a.to !== b.to) return a.to.localeCompare(b.to);
    return a.relation.localeCompare(b.relation);
  });
}

function buildRouteToCollections(inputs, repoToCollections) {
  const dep = inputs.dependencyGraph || {};
  const routeToUsecase = dep.route_to_usecase || {};
  const usecaseToRepo = dep.usecase_to_repo || {};
  const out = new Map();
  for (const routeFile of Object.keys(routeToUsecase)) {
    const usecases = stringifyArray(routeToUsecase[routeFile]);
    const collections = new Set();
    for (const usecase of usecases) {
      const repos = stringifyArray(usecaseToRepo[usecase]);
      for (const repo of repos) {
        if (!repoToCollections.has(repo)) continue;
        for (const collection of repoToCollections.get(repo)) {
          collections.add(collection);
        }
      }
    }
    out.set(routeFile, collections);
  }
  return out;
}

function buildEntityApiMap(inputs, routeToCollections) {
  const rows = [];
  const matrix = inputs.protectionMatrix && Array.isArray(inputs.protectionMatrix.protection_matrix)
    ? inputs.protectionMatrix.protection_matrix
    : [];

  for (const endpoint of matrix) {
    const method = endpoint && endpoint.method ? endpoint.method : 'UNKNOWN';
    const api = endpoint && endpoint.path ? endpoint.path : 'UNKNOWN';
    const evidence = normalizeEvidence(endpoint && endpoint.evidence ? endpoint.evidence : [inputPathLine('protectionMatrix', '"protection_matrix"')]);
    const routeFiles = stringifyArray(endpoint && endpoint.route_files);
    const writes = new Set(stringifyArray(endpoint && endpoint.writes_collections));

    for (const collection of writes) {
      rows.push({
        entity: toEntityName(collection),
        api,
        method,
        readWrite: 'write',
        evidence
      });
    }

    for (const routeFile of routeFiles) {
      const mapped = routeToCollections.get(routeFile);
      if (!mapped) continue;
      for (const collection of mapped) {
        if (writes.has(collection)) continue;
        rows.push({
          entity: toEntityName(collection),
          api,
          method,
          readWrite: 'read',
          evidence: normalizeEvidence([`${routeFile}:1`].concat(evidence))
        });
      }
    }

    if (!writes.size && routeFiles.length === 0) {
      rows.push({
        entity: 'UnknownEntity',
        api,
        method,
        readWrite: 'read',
        evidence
      });
    }
  }

  return uniqueBy(rows, (row) => `${row.entity}|${row.api}|${row.method}|${row.readWrite}`);
}

function buildStateMachineMap(inputs) {
  const rows = [];
  const transitions = inputs.stateTransitions || {};
  for (const entityName of Object.keys(transitions)) {
    const detail = transitions[entityName] || {};
    const states = stringifyArray(detail.states);
    for (const state of states) {
      rows.push({
        entity: entityName,
        state,
        transition: 'state_defined',
        trigger: 'state_catalog',
        evidence: normalizeEvidence([inputPathLine('stateTransitions', `"${entityName}"`)])
      });
    }
    for (const transition of Array.isArray(detail.transitions) ? detail.transitions : []) {
      rows.push({
        entity: entityName,
        state: transition.to || 'unknown',
        transition: `${transition.from || '*'} -> ${transition.to || 'unknown'}`,
        trigger: transition.writer || 'unknown_writer',
        evidence: normalizeEvidence([
          transition.writer || null,
          inputPathLine('stateTransitions', `"${entityName}"`)
        ])
      });
    }
  }
  return rows;
}

function buildDataFlow() {
  return [
    {
      step: '1',
      from: 'User(Line)',
      to: 'webhookLine',
      entity: 'Users',
      action: 'ingest_message_and_trace_seed',
      evidence: normalizeEvidence([
        'src/routes/webhookLine.js:175',
        'src/routes/webhookLine.js:2338'
      ])
    },
    {
      step: '2',
      from: 'webhookLine',
      to: 'computeUserTasks',
      entity: 'JourneyTodoItems',
      action: 'next_action_materialize',
      evidence: normalizeEvidence([
        'src/routes/webhookLine.js:2399',
        'src/usecases/tasks/computeUserTasks.js:1',
        'src/repos/firestore/journeyTodoItemsRepo.js:1'
      ])
    },
    {
      step: '3',
      from: 'Admin(osNotifications)',
      to: 'createNotification/approveNotification',
      entity: 'Notifications',
      action: 'notification_draft_and_activate',
      evidence: normalizeEvidence([
        'src/routes/admin/osNotifications.js:1',
        'src/usecases/notifications/createNotification.js:1',
        'src/usecases/adminOs/approveNotification.js:1'
      ])
    },
    {
      step: '4',
      from: 'sendNotification',
      to: 'deliveriesRepo',
      entity: 'NotificationDeliveries',
      action: 'delivery_write_and_status_update',
      evidence: normalizeEvidence([
        'src/usecases/notifications/sendNotification.js:1',
        'src/repos/firestore/deliveriesRepo.js:1'
      ])
    },
    {
      step: '5',
      from: 'delivery failure',
      to: 'retryQueuedSend',
      entity: 'SendRetryQueue',
      action: 'retry_enqueue_and_execute',
      evidence: normalizeEvidence([
        'src/usecases/phase68/executeSegmentSend.js:540',
        'src/usecases/phase73/retryQueuedSend.js:22',
        'src/repos/firestore/sendRetryQueueRepo.js:1'
      ])
    },
    {
      step: '6',
      from: 'declareCityRegionFromLine',
      to: 'runCityPackDraftJob',
      entity: 'CityPacks + SourceRefs',
      action: 'regional_pack_and_vendor_source_materialize',
      evidence: normalizeEvidence([
        'src/usecases/cityPack/declareCityRegionFromLine.js:1',
        'src/usecases/cityPack/runCityPackDraftJob.js:159',
        'src/repos/firestore/cityPacksRepo.js:1',
        'src/repos/firestore/sourceRefsRepo.js:1'
      ])
    },
    {
      step: '7',
      from: 'runCityPackSourceAuditJob',
      to: 'sourceEvidenceRepo + cityPackBulletinsRepo',
      entity: 'SourceEvidence + CityPackBulletins',
      action: 'source_fetch_diff_and_evidence',
      evidence: normalizeEvidence([
        'src/usecases/cityPack/runCityPackSourceAuditJob.js:71',
        'src/repos/firestore/sourceEvidenceRepo.js:1',
        'src/repos/firestore/cityPackBulletinsRepo.js:1'
      ])
    },
    {
      step: '8',
      from: 'phaseLLM4FaqAnswer',
      to: 'llmClient',
      entity: 'LlmResponse',
      action: 'llm_request_response',
      evidence: normalizeEvidence([
        'src/routes/phaseLLM4FaqAnswer.js:1',
        'src/infra/llmClient.js:63'
      ])
    },
    {
      step: '9',
      from: 'llm response',
      to: 'faqAnswerLogs + llmUsageLogs',
      entity: 'FaqAnswerLogs + LlmUsageLogs',
      action: 'llm_result_persist',
      evidence: normalizeEvidence([
        'src/usecases/faq/answerFaqFromKb.js:1',
        'src/repos/firestore/faqAnswerLogsRepo.js:1',
        'src/repos/firestore/llmUsageLogsRepo.js:1'
      ])
    },
    {
      step: '10',
      from: 'trace aware writes',
      to: 'auditLogs + decisionTimeline',
      entity: 'AuditLogs + DecisionTimeline',
      action: 'audit_reconstruction_anchor',
      evidence: normalizeEvidence([
        'src/repos/firestore/auditLogsRepo.js:36',
        'src/repos/firestore/decisionTimelineRepo.js:63'
      ])
    }
  ];
}

function inferEntityFromJobText(text) {
  const value = String(text || '').toLowerCase();
  if (value.includes('journey') && value.includes('kpi')) return 'JourneyKpiDaily';
  if (value.includes('journey') && value.includes('reminder')) return 'JourneyTodoItems';
  if (value.includes('city-pack') || value.includes('citypack')) return 'CityPacks + SourceRefs';
  if (value.includes('context-snapshot')) return 'UserContextSnapshots';
  if (value.includes('retry')) return 'SendRetryQueue';
  if (value.includes('notification')) return 'Notifications + NotificationDeliveries';
  if (value.includes('retention')) return 'RetentionManagedCollections';
  return 'UnknownEntity';
}

function buildEventAndJobMap() {
  const rows = [];
  const workflowFiles = listFilesRecursive(WORKFLOWS_DIR, (p) => /\.(yml|yaml)$/.test(p));
  for (const absPath of workflowFiles) {
    const relPath = rel(absPath);
    const lines = readText(absPath).split(/\r?\n/);
    let cron = null;
    let hasWorkflowDispatch = false;
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const cronMatch = line.match(/cron:\s*['"]?([^'"]+)['"]?/);
      if (cronMatch) {
        cron = cronMatch[1];
        rows.push({
          job: path.basename(relPath),
          trigger: `cron:${cron}`,
          entity: inferEntityFromJobText(relPath),
          evidence: normalizeEvidence([`${relPath}:${i + 1}`])
        });
      }
      if (/workflow_dispatch:/.test(line)) {
        hasWorkflowDispatch = true;
        rows.push({
          job: path.basename(relPath),
          trigger: 'workflow_dispatch',
          entity: inferEntityFromJobText(relPath),
          evidence: normalizeEvidence([`${relPath}:${i + 1}`])
        });
      }
      const runMatch = line.match(/run:\s*(.+)$/);
      if (runMatch && /(npm run|node\s+scripts|node\s+tools)/.test(runMatch[1])) {
        rows.push({
          job: runMatch[1].trim(),
          trigger: cron ? `cron:${cron}` : (hasWorkflowDispatch ? 'workflow_dispatch' : 'ci'),
          entity: inferEntityFromJobText(runMatch[1]),
          evidence: normalizeEvidence([`${relPath}:${i + 1}`])
        });
      }
    }
  }

  const internalRoutes = listFilesRecursive(path.join(ROUTES_DIR, 'internal'), (p) => p.endsWith('.js'));
  for (const absPath of internalRoutes) {
    const relPath = rel(absPath);
    rows.push({
      job: path.basename(relPath, '.js'),
      trigger: 'internal_http_with_x_internal_job_token',
      entity: inferEntityFromJobText(relPath),
      evidence: normalizeEvidence([`${relPath}:1`])
    });
  }

  const usecaseJobFiles = listFilesRecursive(USECASES_DIR, (p) => /run[A-Za-z0-9]+Job\.js$/.test(p));
  for (const absPath of usecaseJobFiles) {
    const relPath = rel(absPath);
    rows.push({
      job: path.basename(relPath, '.js'),
      trigger: 'invoked_by_internal_route_or_scheduler',
      entity: inferEntityFromJobText(relPath),
      evidence: normalizeEvidence([`${relPath}:1`])
    });
  }

  const retryBackfillFiles = listFilesRecursive(USECASES_DIR, (p) => /retry|backfill/i.test(path.basename(p)) && p.endsWith('.js'));
  for (const absPath of retryBackfillFiles) {
    const relPath = rel(absPath);
    rows.push({
      job: path.basename(relPath, '.js'),
      trigger: 'retry_or_backfill_manual_flow',
      entity: inferEntityFromJobText(relPath),
      evidence: normalizeEvidence([`${relPath}:1`])
    });
  }

  return uniqueBy(rows, (row) => `${row.job}|${row.trigger}|${row.entity}`);
}

function mapRole(authRequired) {
  const value = String(authRequired || '').toLowerCase();
  if (!value || value === 'none' || value === 'false') return 'public';
  if (value.includes('admin')) return 'admin';
  if (value.includes('internal')) return 'operator';
  if (value.includes('member') || value.includes('user')) return 'member';
  return 'operator';
}

function buildPermissionMatrix(inputs, routeToCollections) {
  const rows = [];
  const matrix = inputs.protectionMatrix && Array.isArray(inputs.protectionMatrix.protection_matrix)
    ? inputs.protectionMatrix.protection_matrix
    : [];

  for (const endpoint of matrix) {
    const role = mapRole(endpoint && endpoint.auth_required);
    const evidence = normalizeEvidence(endpoint && endpoint.evidence ? endpoint.evidence : [inputPathLine('protectionMatrix', '"protection_matrix"')]);
    const writes = stringifyArray(endpoint && endpoint.writes_collections);
    if (writes.length) {
      for (const collection of writes) {
        rows.push({
          role,
          entity: toEntityName(collection),
          action: 'write',
          evidence
        });
      }
    } else {
      const routeFiles = stringifyArray(endpoint && endpoint.route_files);
      if (!routeFiles.length) {
        rows.push({
          role,
          entity: 'RouteSurface',
          action: 'read',
          evidence
        });
      } else {
        for (const routeFile of routeFiles) {
          const collections = routeToCollections.get(routeFile);
          if (collections && collections.size) {
            for (const collection of collections) {
              rows.push({
                role,
                entity: toEntityName(collection),
                action: 'read',
                evidence: normalizeEvidence([`${routeFile}:1`].concat(evidence))
              });
            }
          } else {
            rows.push({
              role,
              entity: `Route:${path.basename(routeFile, '.js')}`,
              action: 'read',
              evidence: normalizeEvidence([`${routeFile}:1`].concat(evidence))
            });
          }
        }
      }
    }
  }

  rows.push({
    role: 'developer',
    entity: 'KnowledgeGraphDocs',
    action: 'generate_check',
    evidence: normalizeEvidence([`package.json:${findLineNumber(PKG_PATH, '"docs-artifacts:generate"')}`])
  });

  return uniqueBy(rows, (row) => `${row.role}|${row.entity}|${row.action}`);
}

function buildLlmDataFlow(inputs) {
  const rows = [];
  const boundaryRows = inputs.llmInputBoundaries && Array.isArray(inputs.llmInputBoundaries.llm_input_boundaries)
    ? inputs.llmInputBoundaries.llm_input_boundaries
    : [];
  for (const row of boundaryRows) {
    const file = row && row.file ? row.file : null;
    if (!file) continue;
    rows.push({
      input: `boundary:${path.basename(file, '.js')}`,
      output: 'bounded_llm_payload',
      entity: 'LlmInputBoundary',
      evidence: normalizeEvidence([`${file}:1`, inputPathLine('llmInputBoundaries', `"${file}"`)])
    });
  }

  rows.push({
    input: 'bounded_llm_payload',
    output: 'openai_chat_completions_json',
    entity: 'LlmResponse',
    evidence: normalizeEvidence([
      'src/infra/llmClient.js:63',
      'src/infra/llmClient.js:69'
    ])
  });

  const dep = inputs.dependencyGraph || {};
  const usecaseToRepo = dep.usecase_to_repo || {};
  const repoToCollection = dep.repo_to_collection || {};
  for (const usecaseName of Object.keys(usecaseToRepo)) {
    const lowered = usecaseName.toLowerCase();
    if (!lowered.includes('llm') && !lowered.includes('faq')) continue;
    const repos = stringifyArray(usecaseToRepo[usecaseName]);
    for (const repoName of repos) {
      const collections = stringifyArray(repoToCollection[repoName]);
      for (const collection of collections) {
        rows.push({
          input: `usecase:${usecaseName}`,
          output: `persist:${collection}`,
          entity: toEntityName(collection),
          evidence: normalizeEvidence([
            inputPathLine('dependencyGraph', `"${usecaseName}"`),
            `src/repos/firestore/${repoName}.js:1`
          ])
        });
      }
    }
  }

  rows.push({
    input: 'line_user_message',
    output: 'faq_answer_or_guarded_refusal',
    entity: 'FaqAnswerLogs',
    evidence: normalizeEvidence([
      'src/routes/phaseLLM4FaqAnswer.js:1',
      'src/usecases/llm/guardLlmOutput.js:1',
      'src/repos/firestore/faqAnswerLogsRepo.js:1'
    ])
  });

  return uniqueBy(rows, (row) => `${row.input}|${row.output}|${row.entity}`);
}

function buildSsotHierarchy(inputs, lifecycleMap) {
  const rows = [];
  const modelRows = Array.isArray(inputs.dataModelMap && inputs.dataModelMap.collections)
    ? inputs.dataModelMap.collections
    : [];
  for (const model of modelRows) {
    const collection = model && model.collection ? model.collection : null;
    if (!collection) continue;
    const lifecycle = lifecycleMap.get(collection) || {};
    const kind = String(lifecycle.kind || '').toLowerCase();
    const recomputable = lifecycle.recomputable === true;
    const canonical = (!recomputable && kind !== 'aggregate' && kind !== 'cache') ? 'YES' : 'NO';
    const derived = (recomputable || kind === 'aggregate' || kind === 'derived') ? 'YES' : 'NO';
    const cache = kind === 'cache' ? 'YES' : 'NO';
    rows.push({
      entity: toEntityName(collection),
      canonical,
      derived,
      cache,
      evidence: normalizeEvidence([
        lifecycle.evidence || null,
        inputPathLine('dataLifecycle', `"collection": "${collection}"`)
      ])
    });
  }
  return rows;
}

function buildAuditReconstructionMap() {
  return [
    {
      event: 'line_webhook_ingest',
      entity: 'Users',
      trace: 'traceId seeded from webhook payload and reused as requestId',
      evidence: normalizeEvidence([
        'src/routes/webhookLine.js:175',
        'src/routes/webhookLine.js:1806'
      ])
    },
    {
      event: 'notification_create',
      entity: 'Notifications',
      trace: 'traceId persisted in notification flow and audit timeline',
      evidence: normalizeEvidence([
        'src/usecases/notifications/createNotification.js:1',
        'src/usecases/notifications/sendNotification.js:1'
      ])
    },
    {
      event: 'delivery_result',
      entity: 'NotificationDeliveries',
      trace: 'delivery rows preserve trace for retries and analytics',
      evidence: normalizeEvidence([
        'src/repos/firestore/deliveriesRepo.js:303',
        'src/usecases/phase73/retryQueuedSend.js:22'
      ])
    },
    {
      event: 'audit_append',
      entity: 'AuditLogs',
      trace: 'listAuditLogsByTraceId supports reverse lookup',
      evidence: normalizeEvidence([
        'src/repos/firestore/auditLogsRepo.js:36'
      ])
    },
    {
      event: 'decision_timeline_append',
      entity: 'DecisionTimeline',
      trace: 'listTimelineEntriesByTraceId supports reverse lookup',
      evidence: normalizeEvidence([
        'src/repos/firestore/decisionTimelineRepo.js:63'
      ])
    },
    {
      event: 'city_pack_source_audit',
      entity: 'SourceEvidence',
      trace: 'source evidence stored with trace and recoverable by trace query',
      evidence: normalizeEvidence([
        'src/usecases/cityPack/runCityPackSourceAuditJob.js:249',
        'src/repos/firestore/sourceEvidenceRepo.js:64'
      ])
    },
    {
      event: 'llm_usage',
      entity: 'LlmActionLogs',
      trace: 'llm action log normalizes traceId for replay',
      evidence: normalizeEvidence([
        'src/repos/firestore/llmActionLogsRepo.js:267'
      ])
    }
  ];
}

function buildFailureRecoveryMap(runtime) {
  const rows = [
    {
      failure: 'validation_error',
      recovery: 'fail_closed validator response and reject write before persistence',
      evidence: normalizeEvidence([
        'src/domain/validators.js:1',
        'src/usecases/notifications/validateNotificationPayload.js:1'
      ])
    },
    {
      failure: 'auth_error',
      recovery: 'admin/internal token guards stop route execution',
      evidence: normalizeEvidence([
        'src/index.js:150',
        'src/routes/internal/cityPackSourceAuditJob.js:27'
      ])
    },
    {
      failure: 'kill_switch_enabled',
      recovery: 'kill switch gate blocks send and job execution until flag reset',
      evidence: normalizeEvidence([
        'src/domain/validators.js:171',
        inputPathLine('killSwitchPoints', '"kill_switch_points"')
      ])
    },
    {
      failure: 'external_provider_failure',
      recovery: 'error classification + retry queue + source audit status downgrade',
      evidence: normalizeEvidence([
        'src/infra/llmClient.js:78',
        'src/usecases/phase68/executeSegmentSend.js:540',
        'src/usecases/cityPack/runCityPackSourceAuditJob.js:330'
      ])
    },
    {
      failure: 'retry_exhausted',
      recovery: 'retryQueuedSend give-up path marks queue item with terminal state',
      evidence: normalizeEvidence([
        'src/usecases/phase73/retryQueuedSend.js:22',
        'src/usecases/phase73/giveUpRetryQueuedSend.js:1'
      ])
    },
    {
      failure: 'backfill_mismatch',
      recovery: 'deliveryBackfillAdmin checks plan hash and refuses unsafe replay',
      evidence: normalizeEvidence([
        'src/usecases/deliveries/deliveryBackfillAdmin.js:163',
        'src/usecases/deliveries/deliveryBackfillAdmin.js:172'
      ])
    }
  ];

  if (runtime && runtime.firestore && runtime.firestore.status === 'UNOBSERVED_RUNTIME') {
    rows.push({
      failure: 'firestore_runtime_unobserved',
      recovery: `mark Firestore runtime as UNOBSERVED_RUNTIME and continue static audit (${runtime.firestore.reason || 'reauth required'})`,
      evidence: normalizeEvidence([
        runtime.firestore.evidence || 'runtime:firebase-admin firestore listCollections@UNOBSERVED_RUNTIME'
      ])
    });
  }

  return rows;
}

function buildInfraMap(runtime) {
  const rows = [];
  const runServices = runtime && runtime.cloudRun && Array.isArray(runtime.cloudRun.services)
    ? runtime.cloudRun.services
    : [];
  for (const service of runServices) {
    rows.push({
      component: `CloudRun:${service.name}`,
      dependency: `region=${service.region || 'unknown'}, serviceAccount=${service.serviceAccount || 'unknown'}, image=${service.image || 'unknown'}`,
      evidence: normalizeEvidence([runtime.cloudRun.evidence || 'runtime:gcloud run services list@UNOBSERVED_RUNTIME'])
    });
    for (const secretRef of stringifyArray(service.secretRefs)) {
      rows.push({
        component: `CloudRunSecretRef:${service.name}`,
        dependency: `SecretManager:${secretRef}`,
        evidence: normalizeEvidence([runtime.cloudRun.evidence || 'runtime:gcloud run services list@UNOBSERVED_RUNTIME'])
      });
    }
  }

  const secretNames = runtime && runtime.secretManager && Array.isArray(runtime.secretManager.secretNames)
    ? runtime.secretManager.secretNames
    : [];
  for (const secretName of secretNames) {
    rows.push({
      component: `SecretManager:${secretName}`,
      dependency: 'name_only_no_secret_value',
      evidence: normalizeEvidence([runtime.secretManager.evidence || 'runtime:gcloud secrets list@UNOBSERVED_RUNTIME'])
    });
  }

  rows.push({
    component: 'LLMProvider',
    dependency: 'https://api.openai.com/v1/chat/completions',
    evidence: normalizeEvidence(['src/infra/llmClient.js:69'])
  });

  rows.push({
    component: 'FirestoreAdminSdk',
    dependency: 'firebase-admin credentials via ADC',
    evidence: normalizeEvidence(['src/infra/firestore.js:1'])
  });

  rows.push({
    component: 'VendorSourceFetch',
    dependency: 'HTTP fetch to sourceRef.url in City Pack source audit',
    evidence: normalizeEvidence(['src/usecases/cityPack/runCityPackSourceAuditJob.js:71'])
  });

  rows.push({
    component: 'WebSearchProvider',
    dependency: 'infra web search adapter for citation source normalization',
    evidence: normalizeEvidence(['src/infra/webSearch/provider.js:1'])
  });

  if (runtime && runtime.firestore && runtime.firestore.status === 'UNOBSERVED_RUNTIME') {
    rows.push({
      component: 'FirestoreRuntimeProbe',
      dependency: `UNOBSERVED_RUNTIME (${runtime.firestore.reason || 'reauth required'})`,
      evidence: normalizeEvidence([runtime.firestore.evidence || 'runtime:firebase-admin firestore listCollections@UNOBSERVED_RUNTIME'])
    });
  }

  return uniqueBy(rows, (row) => `${row.component}|${row.dependency}`);
}

function isPiiCollection(collection) {
  const text = String(collection || '').toLowerCase();
  const piiTokens = ['user', 'consent', 'delivery', 'notification', 'audit', 'trace', 'billing', 'profile', 'subscription', 'llm', 'event'];
  return piiTokens.some((token) => text.includes(token));
}

function buildRetentionAndPiiMap(inputs, lifecycleMap) {
  const rows = [];
  const modelRows = Array.isArray(inputs.dataModelMap && inputs.dataModelMap.collections)
    ? inputs.dataModelMap.collections
    : [];
  for (const model of modelRows) {
    const collection = model && model.collection ? model.collection : null;
    if (!collection) continue;
    const lifecycle = lifecycleMap.get(collection) || {};
    rows.push({
      entity: toEntityName(collection),
      retention: lifecycle.retention || 'UNOBSERVED_STATIC',
      pii: isPiiCollection(collection) ? 'YES' : 'NO',
      delete: lifecycle.deletable === undefined ? 'UNOBSERVED_STATIC' : String(lifecycle.deletable),
      audit: String(lifecycle.kind || '').toLowerCase() === 'evidence' || collection.includes('audit') || collection.includes('decision')
        ? 'YES'
        : 'NO',
      evidence: normalizeEvidence([
        lifecycle.evidence || null,
        inputPathLine('dataLifecycle', `"collection": "${collection}"`)
      ])
    });
  }
  return rows;
}

function buildGraphCore() {
  const edges = [
    {
      from: 'User',
      to: 'JourneyTodoItems',
      relation: 'progresses',
      evidence: normalizeEvidence(['src/routes/webhookLine.js:2399', 'src/repos/firestore/journeyTodoItemsRepo.js:1'])
    },
    {
      from: 'JourneyTodoItems',
      to: 'Tasks',
      relation: 'references_task_content',
      evidence: normalizeEvidence(['src/repos/firestore/taskContentsRepo.js:1', 'src/usecases/tasks/computeUserTasks.js:1'])
    },
    {
      from: 'Tasks',
      to: 'Notifications',
      relation: 'can_trigger',
      evidence: normalizeEvidence(['src/usecases/notifications/createNotification.js:1', 'src/routes/admin/osNotifications.js:1'])
    },
    {
      from: 'Notifications',
      to: 'NotificationDeliveries',
      relation: 'delivery_records',
      evidence: normalizeEvidence(['src/usecases/notifications/sendNotification.js:1', 'src/repos/firestore/deliveriesRepo.js:1'])
    },
    {
      from: 'NotificationDeliveries',
      to: 'SendRetryQueue',
      relation: 'failed_delivery_retry',
      evidence: normalizeEvidence(['src/usecases/phase68/executeSegmentSend.js:540', 'src/usecases/phase73/retryQueuedSend.js:22'])
    },
    {
      from: 'NotificationDeliveries',
      to: 'AuditLogs',
      relation: 'audit_append',
      evidence: normalizeEvidence(['src/repos/firestore/auditLogsRepo.js:1'])
    },
    {
      from: 'AuditLogs',
      to: 'DecisionTimeline',
      relation: 'trace_reconstruction',
      evidence: normalizeEvidence(['src/repos/firestore/decisionTimelineRepo.js:1', 'src/repos/firestore/auditLogsRepo.js:36'])
    },
    {
      from: 'CityPacks',
      to: 'SourceRefs',
      relation: 'vendor_source_binding',
      evidence: normalizeEvidence(['src/usecases/cityPack/runCityPackDraftJob.js:159', 'src/repos/firestore/sourceRefsRepo.js:1'])
    },
    {
      from: 'SourceRefs',
      to: 'SourceEvidence',
      relation: 'audit_fetch_and_diff',
      evidence: normalizeEvidence(['src/usecases/cityPack/runCityPackSourceAuditJob.js:249', 'src/repos/firestore/sourceEvidenceRepo.js:1'])
    },
    {
      from: 'SourceEvidence',
      to: 'CityPackBulletins',
      relation: 'risk_bulletin_generation',
      evidence: normalizeEvidence(['src/usecases/cityPack/runCityPackSourceAuditJob.js:399', 'src/repos/firestore/cityPackBulletinsRepo.js:1'])
    },
    {
      from: 'User',
      to: 'LlmInputBoundary',
      relation: 'faq_or_concierge_input',
      evidence: normalizeEvidence(['src/routes/phaseLLM4FaqAnswer.js:1', 'src/usecases/llm/buildLlmInputView.js:1'])
    },
    {
      from: 'LlmInputBoundary',
      to: 'LlmClient',
      relation: 'prompt_to_provider',
      evidence: normalizeEvidence(['src/infra/llmClient.js:46', 'src/infra/llmClient.js:69'])
    },
    {
      from: 'LlmClient',
      to: 'FaqAnswerLogs',
      relation: 'response_persist',
      evidence: normalizeEvidence(['src/usecases/faq/answerFaqFromKb.js:1', 'src/repos/firestore/faqAnswerLogsRepo.js:1'])
    }
  ];

  const nodes = uniqueBy(
    edges
      .flatMap((edge) => [edge.from, edge.to])
      .map((label) => ({ id: label.replace(/[^A-Za-z0-9_]/g, '_'), label })),
    (node) => node.id
  );

  const evidenceRegistry = {};
  let evidenceCounter = 1;
  const edgeRows = edges.map((edge) => {
    const evidenceIds = [];
    for (const ev of edge.evidence) {
      const key = String(ev);
      if (!Object.prototype.hasOwnProperty.call(evidenceRegistry, key)) {
        evidenceRegistry[key] = `E${evidenceCounter}`;
        evidenceCounter += 1;
      }
      evidenceIds.push(evidenceRegistry[key]);
    }
    return Object.assign({}, edge, { evidenceIds: Array.from(new Set(evidenceIds)) });
  });

  const mermaidLines = ['graph TD'];
  for (const edge of edgeRows) {
    const fromId = edge.from.replace(/[^A-Za-z0-9_]/g, '_');
    const toId = edge.to.replace(/[^A-Za-z0-9_]/g, '_');
    mermaidLines.push(`  ${fromId}["${edge.from}"] -->|"${edge.relation}"| ${toId}["${edge.to}"]`);
  }

  return {
    nodes,
    edges: edgeRows,
    evidenceRegistry: Object.fromEntries(Object.entries(evidenceRegistry).map(([evidence, id]) => [id, evidence])),
    mermaid: mermaidLines.join('\n')
  };
}

function build() {
  ensureDir(KG_DIR);
  const inputs = loadInputs();
  const runtime = loadRuntimeProbe();
  const git = getGitMeta();

  const lifecycleMap = buildLifecycleMap(inputs.dataLifecycle);
  const { repoToCollections } = buildRepoToCollectionMap(inputs.dataModelMap);
  const featureByCollection = buildFeatureByCollectionMap(inputs.featureMap);
  const routeToCollections = buildRouteToCollections(inputs, repoToCollections);

  const projectScope = buildProjectScope(inputs, runtime);
  const entityInventory = buildEntityInventory(inputs, lifecycleMap, featureByCollection, runtime);
  const entitySchema = buildEntitySchema(inputs, lifecycleMap);
  const entityRelations = buildEntityRelations(inputs, repoToCollections);
  const entityApiMap = buildEntityApiMap(inputs, routeToCollections);
  const stateMachine = buildStateMachineMap(inputs);
  const dataFlow = buildDataFlow();
  const eventAndJobs = buildEventAndJobMap();
  const permissionMatrix = buildPermissionMatrix(inputs, routeToCollections);
  const llmDataFlow = buildLlmDataFlow(inputs);
  const ssotHierarchy = buildSsotHierarchy(inputs, lifecycleMap);
  const auditReconstruction = buildAuditReconstructionMap();
  const failureRecovery = buildFailureRecoveryMap(runtime);
  const infraMap = buildInfraMap(runtime);
  const retentionPii = buildRetentionAndPiiMap(inputs, lifecycleMap);
  const graph = buildGraphCore();

  const payload = {
    generatedAt: new Date().toISOString(),
    gitCommit: git.commit,
    branch: git.branch,
    sourceDigest: inputs.auditInputsManifest && inputs.auditInputsManifest.sourceDigest
      ? inputs.auditInputsManifest.sourceDigest
      : 'UNOBSERVED_STATIC',
    runtimeStatus: {
      cloudRun: runtime && runtime.cloudRun ? runtime.cloudRun.status : 'UNOBSERVED_RUNTIME',
      secretManager: runtime && runtime.secretManager ? runtime.secretManager.status : 'UNOBSERVED_RUNTIME',
      firestore: runtime && runtime.firestore ? runtime.firestore.status : 'UNOBSERVED_RUNTIME'
    },
    runtimeReason: runtime && runtime.firestore && runtime.firestore.status === 'UNOBSERVED_RUNTIME'
      ? runtime.firestore.reason || 'reauth required'
      : null,
    tables: {
      PROJECT_SCOPE: projectScope,
      ENTITY_INVENTORY: entityInventory,
      ENTITY_SCHEMA: entitySchema,
      ENTITY_RELATIONS: entityRelations,
      ENTITY_API_MAP: entityApiMap,
      PROJECT_STATE_MACHINE_MAP: stateMachine,
      DATA_FLOW: dataFlow,
      PROJECT_EVENT_AND_JOB_MAP: eventAndJobs,
      PROJECT_PERMISSION_MATRIX: permissionMatrix,
      LLM_DATA_FLOW: llmDataFlow,
      PROJECT_SSOT_HIERARCHY: ssotHierarchy,
      AUDIT_RECONSTRUCTION_MAP: auditReconstruction,
      PROJECT_FAILURE_RECOVERY_MAP: failureRecovery,
      PROJECT_INFRA_MAP: infraMap,
      PROJECT_RETENTION_AND_PII_MAP: retentionPii
    },
    graph
  };

  writeJson(OUTPUT_DATA_PATH, payload);
  console.log(`[knowledge-graph] data graph built: ${rel(OUTPUT_DATA_PATH)}`);
  console.log(`[knowledge-graph] rows entity=${entityInventory.length} schema=${entitySchema.length} api=${entityApiMap.length}`);
}

build();
