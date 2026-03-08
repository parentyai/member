'use strict';

const fs = require('fs');
const path = require('path');
const {
  KG_DIR,
  readJson,
  writeText,
  toTable
} = require('./knowledge_graph_common');

const PATHS = Object.freeze({
  scope: path.join(KG_DIR, 'PROJECT_SCOPE.md'),
  firestoreRuntime: path.join(KG_DIR, 'FIRESTORE_RUNTIME_MAP.md'),
  apiOperation: path.join(KG_DIR, 'API_OPERATION_MAP.md'),
  permissionMatrix: path.join(KG_DIR, 'PROJECT_PERMISSION_MATRIX.md'),
  relations: path.join(KG_DIR, 'ENTITY_RELATIONS.md'),
  ssot: path.join(KG_DIR, 'PROJECT_SSOT_HIERARCHY.md'),
  runtimeProbe: path.join(KG_DIR, 'runtime_probe.json')
});

const OUTPUTS = Object.freeze({
  permissionOperation: path.join(KG_DIR, 'PERMISSION_OPERATION_MAP.md'),
  v3Master: path.join(KG_DIR, 'PROJECT_KNOWLEDGE_GRAPH_V3.md')
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

function splitMarkdownCells(rowBody) {
  const cells = [];
  let buffer = '';
  let escaped = false;
  for (let idx = 0; idx < rowBody.length; idx += 1) {
    const ch = rowBody[idx];
    if (escaped) {
      buffer += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      buffer += ch;
      continue;
    }
    if (ch === '|') {
      cells.push(buffer.trim().replace(/\\\|/g, '|'));
      buffer = '';
      continue;
    }
    buffer += ch;
  }
  cells.push(buffer.trim().replace(/\\\|/g, '|'));
  return cells;
}

function parseCells(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  const body = trimmed.slice(1, -1).trim();
  if (!body) return [];
  return splitMarkdownCells(body);
}

function parseTablesWithLine(lines, lineOffset) {
  const tables = [];
  let idx = 0;
  while (idx < lines.length) {
    const first = parseCells(lines[idx]);
    if (!first) {
      idx += 1;
      continue;
    }
    const second = parseCells(lines[idx + 1] || '');
    if (!second || second.length !== first.length || !second.every((cell) => /^-+$/.test(cell))) {
      idx += 1;
      continue;
    }

    const header = first.slice();
    idx += 2;
    const rows = [];
    while (idx < lines.length) {
      const cells = parseCells(lines[idx]);
      if (!cells || cells.length !== header.length) break;
      const row = {};
      for (let i = 0; i < header.length; i += 1) row[header[i]] = cells[i];
      row.__line = idx + 1 + lineOffset;
      rows.push(row);
      idx += 1;
    }
    tables.push({ header, rows });
  }
  return tables;
}

function findTableByHeaders(tables, headers) {
  for (const table of tables) {
    if (headers.every((header) => table.header.includes(header))) return table;
  }
  return null;
}

function splitEvidence(value) {
  return String(value || '')
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

function extractSectionTable(doc, beginMarker, endMarker, headers) {
  const beginIdx = doc.lines.findIndex((line) => line.includes(beginMarker));
  const endIdx = doc.lines.findIndex((line) => line.includes(endMarker));
  if (beginIdx === -1 || endIdx === -1 || endIdx <= beginIdx) return null;
  const sectionLines = doc.lines.slice(beginIdx + 1, endIdx);
  const tables = parseTablesWithLine(sectionLines, beginIdx + 1);
  return findTableByHeaders(tables, headers);
}

function buildPermissionRowsFromBase(permissionBaseTable, operationTable) {
  const permissions = permissionBaseTable.rows.map((row) => ({
    role: row.Role,
    entity: row.Entity,
    action: String(row.Action || '').toLowerCase(),
    evidence: splitEvidence(row.Evidence).concat([`docs/knowledge-graph/PROJECT_PERMISSION_MATRIX.md:${row.__line}`])
  }));
  const roles = unique(permissions.map((row) => row.role)).sort((a, b) => a.localeCompare(b));

  const rows = [];
  for (const op of operationTable.rows) {
    const action = methodToAction(op.Method);
    const opEvidence = splitEvidence(op.Evidence).concat([`docs/knowledge-graph/API_OPERATION_MAP.md:${op.__line}`]);
    for (const role of roles) {
      const matched = permissions.filter((perm) => (
        perm.role === role
        && perm.entity === op.Entity
      ));
      const allowed = matched.some((perm) => perm.action === action) ? 'YES' : 'NO';
      rows.push({
        role,
        operation: op.Operation,
        entity: op.Entity,
        allowed,
        evidence: unique(
          opEvidence
            .concat(matched.flatMap((perm) => perm.evidence))
            .concat(['docs/knowledge-graph/PERMISSION_OPERATION_MAP.md:1'])
        ).join('<br>')
      });
    }
  }

  const dedup = new Map();
  for (const row of rows) {
    const key = `${row.role}||${row.operation}||${row.entity}`;
    if (!dedup.has(key)) {
      dedup.set(key, row);
      continue;
    }
    const current = dedup.get(key);
    if (current.allowed !== row.allowed) {
      current.allowed = current.allowed === 'YES' || row.allowed === 'YES' ? 'YES' : 'NO';
    }
    current.evidence = unique(splitEvidence(current.evidence).concat(splitEvidence(row.evidence))).join('<br>');
    dedup.set(key, current);
  }
  return Array.from(dedup.values()).sort((a, b) => (
    a.role.localeCompare(b.role)
    || a.operation.localeCompare(b.operation)
    || a.entity.localeCompare(b.entity)
  ));
}

function buildPermissionRows(permissionDoc, operationTable) {
  const extension = extractSectionTable(
    permissionDoc,
    'KG_V2_PERMISSION_OPERATION_BEGIN',
    'KG_V2_PERMISSION_OPERATION_END',
    ['Role', 'Operation', 'Entity', 'Allowed', 'Evidence']
  );
  if (extension && extension.rows.length > 0) {
    return extension.rows.map((row) => ({
      role: row.Role,
      operation: row.Operation,
      entity: row.Entity,
      allowed: row.Allowed,
      evidence: unique(splitEvidence(row.Evidence).concat([`docs/knowledge-graph/PROJECT_PERMISSION_MATRIX.md:${row.__line}`])).join('<br>')
    }));
  }

  const base = findTableByHeaders(
    parseTablesWithLine(permissionDoc.lines, 0),
    ['Role', 'Entity', 'Action', 'Evidence']
  );
  if (!base) {
    throw new Error('permission source table not found in PROJECT_PERMISSION_MATRIX.md');
  }
  return buildPermissionRowsFromBase(base, operationTable);
}

function writePermissionOperationMap(metadata, permissionRows) {
  const lines = [];
  lines.push('# PERMISSION_OPERATION_MAP');
  lines.push('');
  lines.push(`- generatedAt: ${new Date().toISOString()}`);
  lines.push(`- source.generatedAt: ${metadata.generatedAt || 'UNOBSERVED_IN_DOCS'}`);
  lines.push(`- source.gitCommit: ${metadata.gitCommit || 'UNOBSERVED_IN_DOCS'}`);
  lines.push(`- source.branch: ${metadata.branch || 'UNOBSERVED_IN_DOCS'}`);
  lines.push('- note: derived from PROJECT_PERMISSION_MATRIX + API_OPERATION_MAP');
  lines.push('');
  lines.push(toTable(
    ['Role', 'Operation', 'Entity', 'Allowed', 'Evidence'],
    permissionRows.map((row) => [row.role, row.operation, row.entity, row.allowed, row.evidence])
  ));
  lines.push('');
  writeText(OUTPUTS.permissionOperation, lines.join('\n'));
}

function buildMasterV3Doc(runtimeProbe, counts, status, firestoreMeta) {
  const firestore = runtimeProbe && runtimeProbe.firestore ? runtimeProbe.firestore : {};
  const staticCoverage = firestoreMeta && firestoreMeta.staticVsRuntimeCoverage
    ? firestoreMeta.staticVsRuntimeCoverage
    : 'UNOBSERVED_RUNTIME';
  const staticOnlyCollections = firestoreMeta && firestoreMeta.staticOnlyCollections
    ? firestoreMeta.staticOnlyCollections
    : 'UNOBSERVED_RUNTIME';
  const runtimeOnlyCollections = firestoreMeta && firestoreMeta.runtimeOnlyCollections
    ? firestoreMeta.runtimeOnlyCollections
    : 'UNOBSERVED_RUNTIME';
  const lines = [];
  lines.push('# PROJECT_KNOWLEDGE_GRAPH_V3');
  lines.push('');
  lines.push(`- generatedAt: ${new Date().toISOString()}`);
  lines.push('- source: docs/knowledge-graph/*.md (existing artifacts only) + runtime_probe.json');
  lines.push(`- firestoreRuntime: ${firestore.status || 'UNOBSERVED_RUNTIME'}`);
  lines.push(`- firestoreCollectionsObserved: ${typeof firestore.collectionCount === 'number' ? firestore.collectionCount : 'UNOBSERVED_RUNTIME'}`);
  lines.push(`- firestoreStaticCoverage: ${staticCoverage}`);
  lines.push(`- firestoreStaticOnlyCollections: ${staticOnlyCollections}`);
  lines.push(`- firestoreRuntimeOnlyCollections: ${runtimeOnlyCollections}`);
  lines.push(`- joinCardinalityExtension: ${status.relationsJoin}`);
  lines.push(`- ownershipExtension: ${status.ssotOwnership}`);
  lines.push('');
  lines.push('## Coverage');
  lines.push(`- operationRows: ${counts.operations}`);
  lines.push(`- permissionOperationRows: ${counts.permissionOperations}`);
  lines.push(`- uiParameterRows: ${counts.uiParameters}`);
  lines.push(`- failurePropagationRows: ${counts.failurePropagation}`);
  lines.push('');
  lines.push('## Key Paths');
  lines.push('- Notification data path: `User -> JourneyTodoItems -> Tasks -> Notifications -> NotificationDeliveries -> SendRetryQueue -> AuditLogs`');
  lines.push('- CityPack vendor path: `CityPacks -> SourceRefs -> SourceEvidence -> Vendors/CityPackBulletins`');
  lines.push('- LLM path: `LLM Input Boundaries -> llmClient -> LLM logs -> Notification/FAQ surfaces`');
  lines.push('- Evidence reconstruction path: `traceId -> audit_logs + decision_timeline + deliveries`');
  lines.push('- UI control path: `UI_PARAMETER_RELATIONS -> API_OPERATION_MAP -> PERMISSION_OPERATION_MAP`');
  lines.push('');
  lines.push('## Artifacts');
  lines.push(toTable(
    ['Artifact', 'Purpose', 'Evidence'],
    [
      ['FIRESTORE_RUNTIME_MAP.md', 'Firestore collection/fields/sample runtime observation', 'docs/knowledge-graph/FIRESTORE_RUNTIME_MAP.md:1'],
      ['API_OPERATION_MAP.md', 'Operation-level API/entity/writeFields mapping', 'docs/knowledge-graph/API_OPERATION_MAP.md:1'],
      ['PERMISSION_OPERATION_MAP.md', 'Role x operation x entity allow matrix', 'docs/knowledge-graph/PERMISSION_OPERATION_MAP.md:1'],
      ['UI_PARAMETER_RELATIONS.md', 'Admin UI parameter-to-entity links', 'docs/knowledge-graph/UI_PARAMETER_RELATIONS.md:1'],
      ['ADMIN_UI_DATA_RELATION_MAP.md', 'Admin-readable relation graph with mermaid', 'docs/knowledge-graph/ADMIN_UI_DATA_RELATION_MAP.md:1'],
      ['FAILURE_PROPAGATION_MAP.md', 'Failure impact propagation by entity', 'docs/knowledge-graph/FAILURE_PROPAGATION_MAP.md:1'],
      ['PROJECT_SSOT_HIERARCHY.md', 'Data ownership extension (Entity/Canonical/Derived/Editable/Owner)', 'docs/knowledge-graph/PROJECT_SSOT_HIERARCHY.md:1'],
      ['ENTITY_RELATIONS.md', 'Join/key/cardinality extension for entity relations', 'docs/knowledge-graph/ENTITY_RELATIONS.md:1']
    ]
  ));
  lines.push('');
  return lines.join('\n');
}

function run() {
  const scopeDoc = readDoc(PATHS.scope);
  const firestoreRuntimeDoc = readDoc(PATHS.firestoreRuntime);
  const operationDoc = readDoc(PATHS.apiOperation);
  const permissionDoc = readDoc(PATHS.permissionMatrix);
  const relationsDoc = readDoc(PATHS.relations);
  const ssotDoc = readDoc(PATHS.ssot);
  const runtimeProbe = readJson(PATHS.runtimeProbe, {});

  const metadata = parseMetadata(scopeDoc.lines);
  const firestoreMeta = parseMetadata(firestoreRuntimeDoc.lines);
  const operationTable = findTableByHeaders(
    parseTablesWithLine(operationDoc.lines, 0),
    ['Operation', 'API', 'Method', 'Entity', 'WriteFields', 'Evidence']
  );
  if (!operationTable) {
    throw new Error('API_OPERATION_MAP table not found');
  }

  const permissionRows = buildPermissionRows(permissionDoc, operationTable);
  writePermissionOperationMap(metadata, permissionRows);

  const uiParamTable = findTableByHeaders(
    parseTablesWithLine(readDoc(path.join(KG_DIR, 'UI_PARAMETER_RELATIONS.md')).lines, 0),
    ['Parameter', 'Entity', 'Relation', 'Evidence']
  );
  const failurePropTable = findTableByHeaders(
    parseTablesWithLine(readDoc(path.join(KG_DIR, 'FAILURE_PROPAGATION_MAP.md')).lines, 0),
    ['Failure', 'Propagation', 'Recovery', 'Evidence']
  );
  const relationHasJoin = relationsDoc.text.includes('KG_V2_RELATIONS_JOIN_BEGIN') && relationsDoc.text.includes('KG_V2_RELATIONS_JOIN_END');
  const ssotHasOwnership = ssotDoc.text.includes('KG_V2_SSOT_OWNERSHIP_BEGIN') && ssotDoc.text.includes('KG_V2_SSOT_OWNERSHIP_END');

  writeText(
    OUTPUTS.v3Master,
    buildMasterV3Doc(
      runtimeProbe,
      {
        operations: operationTable.rows.length,
        permissionOperations: permissionRows.length,
        uiParameters: uiParamTable ? uiParamTable.rows.length : 0,
        failurePropagation: failurePropTable ? failurePropTable.rows.length : 0
      },
      {
        relationsJoin: relationHasJoin ? 'PRESENT' : 'MISSING',
        ssotOwnership: ssotHasOwnership ? 'PRESENT' : 'MISSING'
      },
      firestoreMeta
    )
  );

  console.log('[knowledge-graph-v3] generated artifacts');
  console.log(`[knowledge-graph-v3] permissionOperations=${permissionRows.length} operations=${operationTable.rows.length}`);
}

run();
