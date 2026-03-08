'use strict';

const fs = require('fs');
const path = require('path');
const { KG_DIR } = require('./knowledge_graph_common');

const REQUIRED_FILES = Object.freeze([
  { file: 'FIRESTORE_RUNTIME_MAP.md', headers: ['Collection', 'FieldCount', 'SampleDoc', 'Evidence'] },
  { file: 'API_OPERATION_MAP.md', headers: ['Operation', 'API', 'Method', 'Entity', 'WriteFields', 'Evidence'] },
  { file: 'UI_PARAMETER_RELATIONS.md', headers: ['Parameter', 'Entity', 'Relation', 'Evidence'] },
  { file: 'ADMIN_UI_DATA_RELATION_MAP.md', headers: ['Parameter', 'Entity', 'Relation', 'Evidence'] },
  { file: 'FAILURE_PROPAGATION_MAP.md', headers: ['Failure', 'Propagation', 'Recovery', 'Evidence'] },
  { file: 'PROJECT_KNOWLEDGE_GRAPH_V2.md', headers: ['Artifact', 'Purpose', 'Evidence'] }
]);

const EXTENDED_FILES = Object.freeze([
  { file: 'ENTITY_RELATIONS.md', begin: '<!-- KG_V2_RELATIONS_JOIN_BEGIN -->', end: '<!-- KG_V2_RELATIONS_JOIN_END -->', headers: ['From', 'To', 'Relation', 'JoinField', 'Cardinality', 'Evidence'] },
  { file: 'PROJECT_PERMISSION_MATRIX.md', begin: '<!-- KG_V2_PERMISSION_OPERATION_BEGIN -->', end: '<!-- KG_V2_PERMISSION_OPERATION_END -->', headers: ['Role', 'Operation', 'Entity', 'Allowed', 'Evidence'] },
  { file: 'PROJECT_SSOT_HIERARCHY.md', begin: '<!-- KG_V2_SSOT_OWNERSHIP_BEGIN -->', end: '<!-- KG_V2_SSOT_OWNERSHIP_END -->', headers: ['Entity', 'Canonical', 'Derived', 'Editable', 'Owner', 'Evidence'] }
]);

const EVIDENCE_RE = /^(runtime:[^@]+@.+|[A-Za-z0-9_.\/-]+\.[A-Za-z0-9]+:[0-9]+)$/;

function parseRow(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  const body = trimmed.slice(1, -1).trim();
  if (!body) return [];
  return body.split(/\s\|\s/).map((cell) => cell.trim());
}

function parseTables(text) {
  const lines = text.split(/\r?\n/);
  const tables = [];
  let idx = 0;
  while (idx < lines.length) {
    const first = parseRow(lines[idx]);
    const second = parseRow(lines[idx + 1] || '');
    if (!first || !second || first.length !== second.length || !second.every((cell) => /^-+$/.test(cell))) {
      idx += 1;
      continue;
    }
    const header = first.slice();
    idx += 2;
    const rows = [];
    while (idx < lines.length) {
      const row = parseRow(lines[idx]);
      if (!row || row.length !== header.length) break;
      rows.push(row);
      idx += 1;
    }
    tables.push({ header, rows });
  }
  return tables;
}

function tableHasHeaders(table, headers) {
  return headers.every((header) => table.header.includes(header));
}

function validateEvidenceFromTables(errors, fileName, tables) {
  for (const table of tables) {
    const evidenceIdx = table.header.indexOf('Evidence');
    if (evidenceIdx === -1) continue;
    for (const row of table.rows) {
      const value = String(row[evidenceIdx] || '').trim();
      if (!value) {
        errors.push(`${fileName}: empty Evidence cell`);
        continue;
      }
      const tokens = value.split('<br>').map((token) => token.trim()).filter(Boolean);
      for (const token of tokens) {
        if (!EVIDENCE_RE.test(token)) {
          errors.push(`${fileName}: invalid Evidence token "${token}"`);
        }
      }
    }
  }
}

function validateMermaid(errors, fileName, text) {
  const block = text.match(/```mermaid[\s\S]*?```/);
  if (!block) {
    errors.push(`${fileName}: mermaid block missing`);
    return;
  }
  if (!/graph\s+TD/.test(block[0])) {
    errors.push(`${fileName}: mermaid graph TD missing`);
  }
}

function run() {
  const errors = [];

  for (const spec of REQUIRED_FILES) {
    const filePath = path.join(KG_DIR, spec.file);
    if (!fs.existsSync(filePath)) {
      errors.push(`${spec.file}: missing`);
      continue;
    }
    const text = fs.readFileSync(filePath, 'utf8');
    const tables = parseTables(text);
    if (!tables.length) {
      errors.push(`${spec.file}: table missing`);
      continue;
    }
    if (!tables.some((table) => tableHasHeaders(table, spec.headers))) {
      errors.push(`${spec.file}: required headers missing (${spec.headers.join(', ')})`);
    }
    validateEvidenceFromTables(errors, spec.file, tables);
    if (spec.file === 'ADMIN_UI_DATA_RELATION_MAP.md') {
      validateMermaid(errors, spec.file, text);
    }
  }

  for (const spec of EXTENDED_FILES) {
    const filePath = path.join(KG_DIR, spec.file);
    if (!fs.existsSync(filePath)) {
      errors.push(`${spec.file}: missing`);
      continue;
    }
    const text = fs.readFileSync(filePath, 'utf8');
    if (!text.includes(spec.begin) || !text.includes(spec.end)) {
      errors.push(`${spec.file}: v2 extension markers missing`);
      continue;
    }
    const start = text.indexOf(spec.begin);
    const end = text.indexOf(spec.end);
    const block = text.slice(start, end + spec.end.length);
    const tables = parseTables(block);
    if (!tables.length) {
      errors.push(`${spec.file}: v2 extension table missing`);
      continue;
    }
    if (!tables.some((table) => tableHasHeaders(table, spec.headers))) {
      errors.push(`${spec.file}: v2 extension headers missing (${spec.headers.join(', ')})`);
    }
    validateEvidenceFromTables(errors, spec.file, tables);
  }

  if (errors.length) {
    console.error('[knowledge-graph-v2] check failed');
    for (const row of errors) console.error(`- ${row}`);
    process.exit(1);
  }

  console.log('[knowledge-graph-v2] check passed');
  console.log(`[knowledge-graph-v2] validated files=${REQUIRED_FILES.length + EXTENDED_FILES.length}`);
}

run();
