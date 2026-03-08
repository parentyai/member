'use strict';

const fs = require('fs');
const path = require('path');
const {
  KG_DIR,
  ensureDir,
  readJson,
  writeText,
  toTable
} = require('./knowledge_graph_common');

const DOCS = Object.freeze({
  scope: path.join(KG_DIR, 'PROJECT_SCOPE.md'),
  inventory: path.join(KG_DIR, 'ENTITY_INVENTORY.md'),
  schema: path.join(KG_DIR, 'ENTITY_SCHEMA.md'),
  relations: path.join(KG_DIR, 'ENTITY_RELATIONS.md'),
  apiMap: path.join(KG_DIR, 'ENTITY_API_MAP.md'),
  state: path.join(KG_DIR, 'PROJECT_STATE_MACHINE_MAP.md'),
  jobs: path.join(KG_DIR, 'PROJECT_EVENT_AND_JOB_MAP.md'),
  permission: path.join(KG_DIR, 'PROJECT_PERMISSION_MATRIX.md'),
  failure: path.join(KG_DIR, 'PROJECT_FAILURE_RECOVERY_MAP.md'),
  infra: path.join(KG_DIR, 'PROJECT_INFRA_MAP.md'),
  retention: path.join(KG_DIR, 'PROJECT_RETENTION_AND_PII_MAP.md'),
  relationMap: path.join(KG_DIR, 'PROJECT_DATA_RELATION_MAP.md'),
  relationGraph: path.join(KG_DIR, 'PROJECT_DATA_SCHEMA_GRAPH.md'),
  llmFlow: path.join(KG_DIR, 'LLM_DATA_FLOW.md'),
  reconstruction: path.join(KG_DIR, 'AUDIT_RECONSTRUCTION_MAP.md'),
  ssot: path.join(KG_DIR, 'PROJECT_SSOT_HIERARCHY.md'),
  runtimeProbe: path.join(KG_DIR, 'runtime_probe.json')
});

const OUTPUTS = Object.freeze({
  firestoreRuntime: path.join(KG_DIR, 'FIRESTORE_RUNTIME_MAP.md'),
  apiOperation: path.join(KG_DIR, 'API_OPERATION_MAP.md'),
  uiParams: path.join(KG_DIR, 'UI_PARAMETER_RELATIONS.md'),
  adminUiMap: path.join(KG_DIR, 'ADMIN_UI_DATA_RELATION_MAP.md'),
  failurePropagation: path.join(KG_DIR, 'FAILURE_PROPAGATION_MAP.md'),
  v2Master: path.join(KG_DIR, 'PROJECT_KNOWLEDGE_GRAPH_V2.md')
});

function readDoc(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return {
    path: filePath,
    text,
    lines: text.split(/\r?\n/)
  };
}

function parseMetadata(lines) {
  const out = {};
  for (const line of lines) {
    const match = line.match(/^- ([^:]+):\s*(.+)$/);
    if (!match) continue;
    out[match[1].trim()] = match[2].trim();
  }
  return out;
}

function parseTableCells(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  const body = trimmed.slice(1, -1).trim();
  if (!body) return [];
  return body.split(/\s\|\s/).map((cell) => cell.trim());
}

function parseTablesWithLine(lines) {
  const tables = [];
  let idx = 0;
  while (idx < lines.length) {
    const first = parseTableCells(lines[idx]);
    if (!first) {
      idx += 1;
      continue;
    }

    const second = parseTableCells(lines[idx + 1] || '');
    if (!second || second.length !== first.length || !second.every((cell) => /^-+$/.test(cell))) {
      idx += 1;
      continue;
    }

    const header = first.slice();
    const rows = [];
    const startLine = idx + 1;
    idx += 2;
    while (idx < lines.length) {
      const rowCells = parseTableCells(lines[idx]);
      if (!rowCells || rowCells.length !== header.length) break;
      const row = {};
      for (let i = 0; i < header.length; i += 1) {
        row[header[i]] = rowCells[i];
      }
      row.__line = idx + 1;
      rows.push(row);
      idx += 1;
    }

    tables.push({ header, rows, startLine });
  }
  return tables;
}

function findTableByHeaders(tables, headers) {
  for (const table of tables) {
    if (headers.every((header) => table.header.includes(header))) return table;
  }
  return null;
}

function splitEvidence(text) {
  return String(text || '')
    .split('<br>')
    .map((token) => token.trim())
    .filter(Boolean);
}

function unique(values) {
  return Array.from(new Set(values));
}

function methodToAction(method) {
  return String(method || '').toUpperCase() === 'GET' ? 'read' : 'write';
}

function stripPrefix(value, prefix) {
  const text = String(value || '');
  return text.startsWith(prefix) ? text.slice(prefix.length) : text;
}

function extractRouteNameFromEvidence(evidenceList) {
  const out = [];
  for (const token of evidenceList) {
    const match = String(token).match(/src\/routes\/(?:admin\/|internal\/)?([A-Za-z0-9_]+)\.js:\d+/);
    if (match) out.push(match[1]);
  }
  return unique(out);
}

function inferJoinField(row) {
  const from = String(row.From || '');
  const to = String(row.To || '');
  const relation = String(row.Relation || '');
  if (relation === 'invokes' || relation === 'uses_repo' || relation === 'reads_writes_collection') {
    return 'N/A(control-flow)';
  }
  if ((from.includes('Users') || from.includes('User')) && to.includes('JourneyTodoItems')) return 'userId';
  if (from.includes('Notifications') && to.includes('NotificationDeliveries')) return 'notificationId';
  if (from.includes('CityPacks') && to.includes('SourceRefs')) return 'sourceRefId (CityPacks.sourceRefs[])';
  if (from.includes('SourceRefs') && to.includes('SourceEvidence')) return 'sourceRefId';
  if (from.includes('AuditLogs') && to.includes('DecisionTimeline')) return 'traceId';
  if (from.includes('Pipeline:Notification') && to.includes('Entity:Notifications')) return 'notificationId';
  return 'UNOBSERVED_IN_DOCS';
}

function inferCardinality(row) {
  const relation = String(row.Relation || '');
  if (relation === 'invokes') return '1:N';
  if (relation === 'uses_repo') return '1:N';
  if (relation === 'reads_writes_collection') return 'N:1';
  if (relation === 'writes') return '1:N';
  if (relation.includes('binding') || relation.includes('references')) return '1:N';
  if (relation.includes('trace')) return '1:N';
  if (relation.includes('inference')) return '1:N';
  return 'UNOBSERVED_IN_DOCS';
}

function appendOrReplaceSection(docPath, sectionKey, sectionTitle, body) {
  const begin = `<!-- KG_V2_${sectionKey}_BEGIN -->`;
  const end = `<!-- KG_V2_${sectionKey}_END -->`;
  const text = fs.readFileSync(docPath, 'utf8');
  const block = `${begin}\n\n## ${sectionTitle}\n\n${body.trim()}\n\n${end}`;
  const pattern = new RegExp(`${begin}[\\s\\S]*?${end}`, 'm');
  const next = pattern.test(text)
    ? text.replace(pattern, block)
    : `${text.trim()}\n\n${block}\n`;
  writeText(docPath, next);
}

function buildFirestoreRuntimeMap(metadata, runtimeProbe) {
  const firestore = runtimeProbe && runtimeProbe.firestore ? runtimeProbe.firestore : {};
  const rows = [];
  if (firestore.status === 'OBSERVED_RUNTIME' && Array.isArray(firestore.collectionSummaries) && firestore.collectionSummaries.length > 0) {
    for (const row of firestore.collectionSummaries) {
      rows.push([
        row.collection,
        row.fieldCount,
        row.sampleDoc || 'NONE',
        firestore.evidence || 'runtime:firebase-admin firestore listCollections@UNOBSERVED_RUNTIME'
      ]);
    }
  } else {
    rows.push([
      'UNOBSERVED_RUNTIME',
      'UNOBSERVED_RUNTIME',
      firestore.reason || 'reauth_required',
      firestore.evidence || 'runtime:firebase-admin firestore listCollections@UNOBSERVED_RUNTIME'
    ]);
  }

  const lines = [];
  lines.push('# FIRESTORE_RUNTIME_MAP');
  lines.push('');
  lines.push(`- generatedAt: ${new Date().toISOString()}`);
  lines.push(`- source.generatedAt: ${metadata['generatedAt'] || 'UNOBSERVED_IN_DOCS'}`);
  lines.push(`- runtime.firestore: ${firestore.status || 'UNOBSERVED_RUNTIME'}`);
  lines.push('');
  lines.push('`gcloud auth login --update-adc` and `gcloud auth application-default login` are required for Firestore runtime sampling.');
  lines.push('');
  lines.push(toTable(['Collection', 'FieldCount', 'SampleDoc', 'Evidence'], rows));
  lines.push('');
  return lines.join('\n');
}

function buildExpandedEntityRelations(entityRelationsTable) {
  const expanded = entityRelationsTable.rows.map((row) => ({
    From: row.From,
    To: row.To,
    Relation: row.Relation,
    JoinField: inferJoinField(row),
    Cardinality: inferCardinality(row),
    Evidence: unique(splitEvidence(row.Evidence).concat([`docs/knowledge-graph/ENTITY_RELATIONS.md:${row.__line}`])).join('<br>')
  }));
  const table = toTable(
    ['From', 'To', 'Relation', 'JoinField', 'Cardinality', 'Evidence'],
    expanded.map((row) => [row.From, row.To, row.Relation, row.JoinField, row.Cardinality, row.Evidence])
  );
  return { expanded, markdownTable: table };
}

function buildOperationGraph(entityRelationsTable, entityApiTable, entitySchemaTable) {
  const repoToEntities = new Map();
  for (const row of entityRelationsTable.rows) {
    if (!String(row.From).startsWith('Repo:')) continue;
    if (!String(row.To).startsWith('Entity:')) continue;
    const repo = stripPrefix(row.From, 'Repo:');
    const entity = stripPrefix(row.To, 'Entity:');
    if (!repoToEntities.has(repo)) repoToEntities.set(repo, new Set());
    repoToEntities.get(repo).add(entity);
  }

  const usecaseToRepos = new Map();
  const operationRouteLinks = [];
  for (const row of entityRelationsTable.rows) {
    if (row.Relation === 'invokes' && String(row.From).startsWith('Route:') && String(row.To).startsWith('Usecase:')) {
      operationRouteLinks.push({
        route: stripPrefix(row.From, 'Route:'),
        operation: stripPrefix(row.To, 'Usecase:'),
        evidence: splitEvidence(row.Evidence).concat([`docs/knowledge-graph/ENTITY_RELATIONS.md:${row.__line}`])
      });
      continue;
    }
    if (row.Relation === 'uses_repo' && String(row.From).startsWith('Usecase:') && String(row.To).startsWith('Repo:')) {
      const usecase = stripPrefix(row.From, 'Usecase:');
      const repo = stripPrefix(row.To, 'Repo:');
      if (!usecaseToRepos.has(usecase)) usecaseToRepos.set(usecase, new Set());
      usecaseToRepos.get(usecase).add(repo);
    }
  }

  const routeToApi = new Map();
  for (const row of entityApiTable.rows) {
    const evidence = splitEvidence(row.Evidence);
    const routeNames = extractRouteNameFromEvidence(evidence);
    for (const routeName of routeNames) {
      if (!routeToApi.has(routeName)) routeToApi.set(routeName, []);
      routeToApi.get(routeName).push({
        api: row.API,
        method: row.Method,
        entity: row.Entity,
        evidence: evidence.concat([`docs/knowledge-graph/ENTITY_API_MAP.md:${row.__line}`])
      });
    }
  }

  const entityFields = new Map();
  for (const row of entitySchemaTable.rows) {
    const entity = row.Entity;
    if (!entityFields.has(entity)) entityFields.set(entity, []);
    entityFields.get(entity).push({
      field: row.Field,
      required: row.Required,
      evidence: splitEvidence(row.Evidence).concat([`docs/knowledge-graph/ENTITY_SCHEMA.md:${row.__line}`])
    });
  }

  const operationRows = [];
  for (const link of operationRouteLinks) {
    const apiRows = routeToApi.get(link.route) || [];
    const repos = Array.from(usecaseToRepos.get(link.operation) || []);
    const entitiesFromUsecase = unique(repos.flatMap((repo) => Array.from(repoToEntities.get(repo) || [])));
    const targetEntities = entitiesFromUsecase.length ? entitiesFromUsecase : unique(apiRows.map((row) => row.entity).filter(Boolean));

    if (!apiRows.length) {
      operationRows.push({
        operation: link.operation,
        api: 'UNOBSERVED_IN_DOCS',
        method: 'UNOBSERVED_IN_DOCS',
        entity: targetEntities[0] || 'UNOBSERVED_IN_DOCS',
        writeFields: 'UNOBSERVED_IN_DOCS',
        action: 'read',
        evidence: unique(link.evidence).join('<br>')
      });
      continue;
    }

    for (const apiRow of apiRows) {
      let entities;
      if (apiRow.entity && targetEntities.length) {
        entities = targetEntities.includes(apiRow.entity)
          ? [apiRow.entity]
          : [apiRow.entity];
      } else if (apiRow.entity) {
        entities = [apiRow.entity];
      } else {
        entities = targetEntities.length ? targetEntities : ['UNOBSERVED_IN_DOCS'];
      }
      for (const entity of entities) {
        const fields = entityFields.get(entity) || [];
        const requiredFields = fields.filter((field) => String(field.required).toUpperCase() === 'YES').map((field) => field.field);
        const fallbackFields = fields.map((field) => field.field);
        const writeFields = unique((requiredFields.length ? requiredFields : fallbackFields).slice(0, 5)).join(', ') || 'UNOBSERVED_IN_DOCS';

        const ev = unique(
          link.evidence
            .concat(apiRow.evidence || [])
            .concat(fields.flatMap((field) => field.evidence || []).slice(0, 2))
        );

        operationRows.push({
          operation: link.operation,
          api: apiRow.api,
          method: apiRow.method,
          entity,
          writeFields,
          action: methodToAction(apiRow.method),
          evidence: ev.join('<br>')
        });
      }
    }
  }

  const merged = new Map();
  for (const row of operationRows) {
    const key = `${row.operation}||${row.api}||${row.method}||${row.entity}`;
    if (!merged.has(key)) {
      merged.set(key, Object.assign({}, row));
      continue;
    }
    const current = merged.get(key);
    current.writeFields = current.writeFields === 'UNOBSERVED_IN_DOCS' ? row.writeFields : current.writeFields;
    current.evidence = unique(splitEvidence(current.evidence).concat(splitEvidence(row.evidence))).join('<br>');
    merged.set(key, current);
  }
  return Array.from(merged.values());
}

function buildPermissionOperationRows(permissionTable, operationRows) {
  const normalizedPermissions = permissionTable.rows.map((row) => ({
    role: row.Role,
    entity: row.Entity,
    action: String(row.Action || '').toLowerCase(),
    evidence: splitEvidence(row.Evidence).concat([`docs/knowledge-graph/PROJECT_PERMISSION_MATRIX.md:${row.__line}`])
  }));

  const roles = unique(normalizedPermissions.map((row) => row.role).filter((role) => role !== 'developer'));
  const rows = [];
  for (const operation of operationRows) {
    for (const role of roles) {
      const matches = normalizedPermissions.filter((perm) => (
        perm.role === role
        && perm.entity === operation.entity
      ));
      const allowed = matches.some((perm) => perm.action === operation.action);
      const evidence = unique(
        [operation.evidence]
          .concat(matches.flatMap((perm) => perm.evidence))
          .concat([`docs/knowledge-graph/API_OPERATION_MAP.md:1`])
      );
      rows.push({
        role,
        operation: operation.operation,
        entity: operation.entity,
        allowed: allowed ? 'YES' : 'NO',
        evidence: evidence.join('<br>')
      });
    }
  }
  return rows;
}

function buildUiParameterRows(entitySchemaTable, operationRows) {
  const candidates = [
    'notificationType',
    'scenario',
    'step',
    'area',
    'cityPack',
    'vendor',
    'audience',
    'category',
    'status',
    'llmSource'
  ];

  const schemaRows = entitySchemaTable.rows.map((row) => ({
    entity: row.Entity,
    field: row.Field,
    evidence: splitEvidence(row.Evidence).concat([`docs/knowledge-graph/ENTITY_SCHEMA.md:${row.__line}`])
  }));

  const rows = [];
  for (const parameter of candidates) {
    const lower = parameter.toLowerCase();
    const direct = schemaRows.filter((row) => row.field.toLowerCase() === lower || row.field.toLowerCase().includes(lower));
    if (direct.length) {
      for (const row of direct) {
        rows.push({
          parameter,
          entity: row.entity,
          relation: `field:${row.field}`,
          evidence: unique(row.evidence).join('<br>')
        });
      }
      continue;
    }

    const apiRelated = operationRows.filter((row) => String(row.api).toLowerCase().includes(lower));
    if (apiRelated.length) {
      for (const row of apiRelated) {
        rows.push({
          parameter,
          entity: row.entity,
          relation: 'api_token_match',
          evidence: row.evidence
        });
      }
      continue;
    }

    rows.push({
      parameter,
      entity: 'UNOBSERVED_IN_DOCS',
      relation: 'UNOBSERVED_IN_DOCS',
      evidence: 'docs/knowledge-graph/ENTITY_SCHEMA.md:1'
    });
  }

  return unique(rows.map((row) => JSON.stringify(row))).map((text) => JSON.parse(text));
}

function buildOwnershipRows(ssotTable, permissionOperationRows, operationRows) {
  const writableByEntity = new Map();
  for (const row of operationRows) {
    if (row.action !== 'write') continue;
    if (!writableByEntity.has(row.entity)) writableByEntity.set(row.entity, new Set());
  }
  for (const row of permissionOperationRows) {
    if (row.allowed !== 'YES') continue;
    if (!writableByEntity.has(row.entity)) continue;
    writableByEntity.get(row.entity).add(row.role);
  }

  const rows = [];
  for (const row of ssotTable.rows) {
    const entity = row.Entity;
    const writers = Array.from(writableByEntity.get(entity) || []);
    const editable = writers.length > 0 ? 'YES' : 'NO';
    const owner = writers.length === 0
      ? 'system'
      : (writers.length === 1 ? writers[0] : `shared(${writers.sort((a, b) => a.localeCompare(b)).join(',')})`);
    rows.push({
      entity,
      canonical: row.Canonical,
      derived: row.Derived,
      editable,
      owner,
      evidence: unique(splitEvidence(row.Evidence).concat([`docs/knowledge-graph/PROJECT_SSOT_HIERARCHY.md:${row.__line}`])).join('<br>')
    });
  }
  return rows;
}

function buildFailurePropagationRows(failureTable, relationTable) {
  const relationRows = relationTable.rows.map((row) => ({
    from: stripPrefix(row.From, 'Entity:'),
    to: stripPrefix(row.To, 'Entity:'),
    relation: row.Relation,
    evidence: splitEvidence(row.Evidence).concat([`docs/knowledge-graph/ENTITY_RELATIONS.md:${row.__line}`])
  }));

  const rows = [];
  for (const failureRow of failureTable.rows) {
    const failure = failureRow.Failure;
    const recovery = failureRow.Recovery;
    const failureLower = String(failure || '').toLowerCase();
    let propagation = 'UNOBSERVED_IN_DOCS';
    const evidence = splitEvidence(failureRow.Evidence).concat([`docs/knowledge-graph/PROJECT_FAILURE_RECOVERY_MAP.md:${failureRow.__line}`]);

    if (failureLower.includes('notification') || failureLower.includes('retry')) {
      propagation = 'Notifications -> NotificationDeliveries -> SendRetryQueue -> AuditLogs';
      const matched = relationRows.filter((row) => (
        (row.from.includes('Notification') && row.to.includes('Notification'))
        || (row.from.includes('Pipeline:Notification') || row.to.includes('SendRetryQueue'))
      ));
      evidence.push(...matched.flatMap((row) => row.evidence).slice(0, 4));
    } else if (failureLower.includes('external') || failureLower.includes('source')) {
      propagation = 'SourceRefs -> SourceEvidence -> CityPackBulletins';
      const matched = relationRows.filter((row) => row.from.includes('Source') || row.to.includes('Source') || row.to.includes('CityPackBulletins'));
      evidence.push(...matched.flatMap((row) => row.evidence).slice(0, 4));
    } else if (failureLower.includes('auth') || failureLower.includes('validation')) {
      propagation = 'RouteGuard -> OperationBlocked -> AuditLogs(optional)';
    } else if (failureLower.includes('kill_switch')) {
      propagation = 'KillSwitchGate -> NotificationPipelineBlocked -> AuditLogs';
    } else if (failureLower.includes('firestore_runtime_unobserved')) {
      propagation = 'RuntimeProbe -> FIRESTORE_RUNTIME_MAP -> ManualReauth';
    }

    rows.push({
      failure,
      propagation,
      recovery,
      evidence: unique(evidence).join('<br>')
    });
  }
  return rows;
}

function buildAdminUiRelationMap(uiParamRows, operationRows) {
  const mermaidLines = ['graph TD'];
  mermaidLines.push('  UI["Admin UI Parameters"] -->|"filters"| Ops["API Operations"]');
  mermaidLines.push('  Ops["API Operations"] -->|"writes/reads"| Entities["Core Entities"]');
  mermaidLines.push('  Entities["Core Entities"] -->|"audited_by"| Evidence["Audit Reconstruction"]');
  mermaidLines.push('  Entities["Core Entities"] -->|"llm_boundaries"| LLM["LLM Data Flow"]');
  mermaidLines.push('  Entities["Core Entities"] -->|"citypack_vendor"| Vendor["SourceRefs / Vendor"]');

  const uiRows = uiParamRows.slice(0, 80).map((row) => [
    row.parameter,
    row.entity,
    row.relation,
    row.evidence
  ]);

  const opRows = operationRows.slice(0, 120).map((row) => [
    row.operation,
    row.entity,
    `${row.method} ${row.api}`,
    row.evidence
  ]);

  const lines = [];
  lines.push('# ADMIN_UI_DATA_RELATION_MAP');
  lines.push('');
  lines.push(`- generatedAt: ${new Date().toISOString()}`);
  lines.push('- source: docs/knowledge-graph/*.md + docs/knowledge-graph/runtime_probe.json');
  lines.push('');
  lines.push('```mermaid');
  lines.push(mermaidLines.join('\n'));
  lines.push('```');
  lines.push('');
  lines.push('## UI Parameter Links');
  lines.push(toTable(['Parameter', 'Entity', 'Relation', 'Evidence'], uiRows));
  lines.push('');
  lines.push('## Operation Links (Top 120)');
  lines.push(toTable(['Operation', 'Entity', 'API', 'Evidence'], opRows));
  lines.push('');
  return lines.join('\n');
}

function buildMasterV2Doc(operationRows, uiParamRows, failurePropagationRows, runtimeProbe) {
  const firestoreStatus = runtimeProbe && runtimeProbe.firestore ? runtimeProbe.firestore.status : 'UNOBSERVED_RUNTIME';
  const lines = [];
  lines.push('# PROJECT_KNOWLEDGE_GRAPH_V2');
  lines.push('');
  lines.push(`- generatedAt: ${new Date().toISOString()}`);
  lines.push('- source: docs/knowledge-graph/*.md (existing artifacts only) + runtime_probe.json');
  lines.push(`- firestoreRuntime: ${firestoreStatus}`);
  lines.push('');
  lines.push('## Coverage');
  lines.push(`- operations: ${operationRows.length}`);
  lines.push(`- ui-parameter-links: ${uiParamRows.length}`);
  lines.push(`- failure-propagation-rows: ${failurePropagationRows.length}`);
  lines.push('');
  lines.push('## Key Paths');
  lines.push('- Notification path: `create/approve/send -> notification_deliveries -> retry_queue -> audit_logs`');
  lines.push('- CityPack Vendor path: `city_packs -> source_refs -> source_evidence -> city_pack_bulletins`');
  lines.push('- LLM path: `llm_input_boundaries -> llmClient -> faq_answer_logs / llm_usage_logs`');
  lines.push('- Evidence reconstruction path: `traceId -> audit_logs + decision_timeline + deliveries`');
  lines.push('');
  lines.push('## Artifacts');
  lines.push(toTable(
    ['Artifact', 'Purpose', 'Evidence'],
    [
      ['FIRESTORE_RUNTIME_MAP.md', 'Firestore runtime collection/sample mapping', 'docs/knowledge-graph/FIRESTORE_RUNTIME_MAP.md:1'],
      ['API_OPERATION_MAP.md', 'Operation-level API/entity/field mapping', 'docs/knowledge-graph/API_OPERATION_MAP.md:1'],
      ['UI_PARAMETER_RELATIONS.md', 'Admin UI parameter to entity relationships', 'docs/knowledge-graph/UI_PARAMETER_RELATIONS.md:1'],
      ['ADMIN_UI_DATA_RELATION_MAP.md', 'Admin-readable data relation graph', 'docs/knowledge-graph/ADMIN_UI_DATA_RELATION_MAP.md:1'],
      ['FAILURE_PROPAGATION_MAP.md', 'Failure impact propagation surface', 'docs/knowledge-graph/FAILURE_PROPAGATION_MAP.md:1']
    ]
  ));
  lines.push('');
  return lines.join('\n');
}

function renderFileWithMeta(filePath, title, metadata, tableHeaders, tableRows, notes) {
  const lines = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`- generatedAt: ${new Date().toISOString()}`);
  lines.push(`- source.generatedAt: ${metadata.generatedAt || 'UNOBSERVED_IN_DOCS'}`);
  lines.push(`- source.gitCommit: ${metadata.gitCommit || 'UNOBSERVED_IN_DOCS'}`);
  lines.push(`- source.branch: ${metadata.branch || 'UNOBSERVED_IN_DOCS'}`);
  if (Array.isArray(notes) && notes.length) {
    for (const note of notes) lines.push(`- note: ${note}`);
  }
  lines.push('');
  lines.push(toTable(tableHeaders, tableRows));
  lines.push('');
  writeText(filePath, lines.join('\n'));
}

function run() {
  ensureDir(KG_DIR);

  const docMap = {};
  for (const key of Object.keys(DOCS)) {
    if (key === 'runtimeProbe') continue;
    docMap[key] = readDoc(DOCS[key]);
  }
  const runtimeProbe = readJson(DOCS.runtimeProbe, {});

  const scopeTables = parseTablesWithLine(docMap.scope.lines);
  const metadata = parseMetadata(docMap.scope.lines);
  const relationsTable = findTableByHeaders(parseTablesWithLine(docMap.relations.lines), ['From', 'To', 'Relation', 'Evidence']);
  const apiTable = findTableByHeaders(parseTablesWithLine(docMap.apiMap.lines), ['Entity', 'API', 'Method', 'Read/Write', 'Evidence']);
  const schemaTable = findTableByHeaders(parseTablesWithLine(docMap.schema.lines), ['Entity', 'Field', 'Type', 'Required', 'Source', 'Evidence']);
  const permissionTable = findTableByHeaders(parseTablesWithLine(docMap.permission.lines), ['Role', 'Entity', 'Action', 'Evidence']);
  const failureTable = findTableByHeaders(parseTablesWithLine(docMap.failure.lines), ['Failure', 'Recovery', 'Evidence']);
  const ssotTable = findTableByHeaders(parseTablesWithLine(docMap.ssot.lines), ['Entity', 'Canonical', 'Derived', 'Cache', 'Evidence']);

  if (!relationsTable || !apiTable || !schemaTable || !permissionTable || !failureTable || !ssotTable || !scopeTables.length) {
    throw new Error('required source tables not found in docs/knowledge-graph/*.md');
  }

  writeText(OUTPUTS.firestoreRuntime, buildFirestoreRuntimeMap(metadata, runtimeProbe));

  const expandedRelations = buildExpandedEntityRelations(relationsTable);
  appendOrReplaceSection(DOCS.relations, 'RELATIONS_JOIN', 'V2 Join/Cardinality Extension', expandedRelations.markdownTable);

  const operationRows = buildOperationGraph(relationsTable, apiTable, schemaTable);
  renderFileWithMeta(
    OUTPUTS.apiOperation,
    'API_OPERATION_MAP',
    metadata,
    ['Operation', 'API', 'Method', 'Entity', 'WriteFields', 'Evidence'],
    operationRows.map((row) => [row.operation, row.api, row.method, row.entity, row.writeFields, row.evidence]),
    ['derived from ENTITY_RELATIONS + ENTITY_API_MAP + ENTITY_SCHEMA']
  );

  const permissionOperationRows = buildPermissionOperationRows(permissionTable, operationRows);
  const permissionExtensionTable = toTable(
    ['Role', 'Operation', 'Entity', 'Allowed', 'Evidence'],
    permissionOperationRows.map((row) => [row.role, row.operation, row.entity, row.allowed, row.evidence])
  );
  appendOrReplaceSection(DOCS.permission, 'PERMISSION_OPERATION', 'V2 Operation Permission Extension', permissionExtensionTable);

  const uiParamRows = buildUiParameterRows(schemaTable, operationRows);
  renderFileWithMeta(
    OUTPUTS.uiParams,
    'UI_PARAMETER_RELATIONS',
    metadata,
    ['Parameter', 'Entity', 'Relation', 'Evidence'],
    uiParamRows.map((row) => [row.parameter, row.entity, row.relation, row.evidence]),
    ['derived from ENTITY_SCHEMA + API_OPERATION_MAP']
  );

  writeText(OUTPUTS.adminUiMap, buildAdminUiRelationMap(uiParamRows, operationRows));

  const ownershipRows = buildOwnershipRows(ssotTable, permissionOperationRows, operationRows);
  const ownershipTable = toTable(
    ['Entity', 'Canonical', 'Derived', 'Editable', 'Owner', 'Evidence'],
    ownershipRows.map((row) => [row.entity, row.canonical, row.derived, row.editable, row.owner, row.evidence])
  );
  appendOrReplaceSection(DOCS.ssot, 'SSOT_OWNERSHIP', 'V2 Ownership Extension', ownershipTable);

  const failurePropagationRows = buildFailurePropagationRows(failureTable, relationsTable);
  renderFileWithMeta(
    OUTPUTS.failurePropagation,
    'FAILURE_PROPAGATION_MAP',
    metadata,
    ['Failure', 'Propagation', 'Recovery', 'Evidence'],
    failurePropagationRows.map((row) => [row.failure, row.propagation, row.recovery, row.evidence]),
    ['derived from PROJECT_FAILURE_RECOVERY_MAP + ENTITY_RELATIONS']
  );

  writeText(OUTPUTS.v2Master, buildMasterV2Doc(operationRows, uiParamRows, failurePropagationRows, runtimeProbe));

  console.log('[knowledge-graph-v2] generated artifacts');
  console.log(`[knowledge-graph-v2] operations=${operationRows.length} uiParams=${uiParamRows.length} failurePropagation=${failurePropagationRows.length}`);
}

run();
