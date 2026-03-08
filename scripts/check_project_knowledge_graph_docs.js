'use strict';

const fs = require('fs');
const path = require('path');
const { KG_DIR } = require('./knowledge_graph_common');

const REQUIRED_DOCS = Object.freeze([
  { file: 'PROJECT_SCOPE.md', headers: ['Layer', 'Component', 'Location', 'Evidence'] },
  { file: 'ENTITY_INVENTORY.md', headers: ['Entity', 'Storage', 'Repo File', 'Purpose', 'Evidence'] },
  { file: 'ENTITY_SCHEMA.md', headers: ['Entity', 'Field', 'Type', 'Required', 'Source', 'Evidence'] },
  { file: 'ENTITY_RELATIONS.md', headers: ['From', 'To', 'Relation', 'Evidence'] },
  { file: 'ENTITY_API_MAP.md', headers: ['Entity', 'API', 'Method', 'Read/Write', 'Evidence'] },
  { file: 'PROJECT_STATE_MACHINE_MAP.md', headers: ['Entity', 'State', 'Transition', 'Trigger', 'Evidence'] },
  { file: 'DATA_FLOW.md', headers: ['Step', 'From', 'To', 'Entity', 'Action', 'Evidence'] },
  { file: 'PROJECT_EVENT_AND_JOB_MAP.md', headers: ['Job', 'Trigger', 'Entity', 'Evidence'] },
  { file: 'PROJECT_PERMISSION_MATRIX.md', headers: ['Role', 'Entity', 'Action', 'Evidence'] },
  { file: 'LLM_DATA_FLOW.md', headers: ['Input', 'Output', 'Entity', 'Evidence'] },
  { file: 'PROJECT_SSOT_HIERARCHY.md', headers: ['Entity', 'Canonical', 'Derived', 'Cache', 'Evidence'] },
  { file: 'AUDIT_RECONSTRUCTION_MAP.md', headers: ['Event', 'Entity', 'Trace', 'Evidence'] },
  { file: 'PROJECT_FAILURE_RECOVERY_MAP.md', headers: ['Failure', 'Recovery', 'Evidence'] },
  { file: 'PROJECT_INFRA_MAP.md', headers: ['Component', 'Dependency', 'Evidence'] },
  { file: 'PROJECT_RETENTION_AND_PII_MAP.md', headers: ['Entity', 'Retention', 'PII', 'Delete', 'Audit', 'Evidence'] },
  { file: 'PROJECT_DATA_RELATION_MAP.md', headers: ['From', 'To', 'Relation', 'Evidence'] },
  { file: 'PROJECT_DATA_SCHEMA_GRAPH.md', headers: ['Evidence ID', 'Evidence'] }
]);

const EVIDENCE_TOKEN_RE = /^(runtime:[^@]+@.+|[A-Za-z0-9_.\/-]+\.[A-Za-z0-9]+:[0-9]+)$/;

function fail(errors, msg) {
  errors.push(msg);
}

function parseRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return [];
  return trimmed
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim());
}

function parseTables(text) {
  const lines = text.split(/\r?\n/);
  const tables = [];
  let idx = 0;
  while (idx < lines.length) {
    if (!lines[idx].trim().startsWith('|')) {
      idx += 1;
      continue;
    }
    const start = idx;
    while (idx < lines.length && lines[idx].trim().startsWith('|')) {
      idx += 1;
    }
    const block = lines.slice(start, idx);
    if (block.length >= 2) {
      const header = parseRow(block[0]);
      const separator = parseRow(block[1]);
      if (header.length > 0 && separator.length === header.length) {
        const rows = block.slice(2).map(parseRow).filter((row) => row.length === header.length);
        tables.push({ header, rows });
      }
    }
  }
  return tables;
}

function ensureHeaders(errors, filePath, tables, expectedHeaders) {
  const found = tables.some((table) => expectedHeaders.every((h) => table.header.includes(h)));
  if (!found) {
    fail(errors, `${filePath}: required headers missing (${expectedHeaders.join(', ')})`);
  }
}

function validateEvidenceCells(errors, filePath, tables) {
  for (const table of tables) {
    const evidenceIndex = table.header.indexOf('Evidence');
    if (evidenceIndex === -1) continue;
    for (const row of table.rows) {
      const cell = String(row[evidenceIndex] || '').trim();
      if (!cell) {
        fail(errors, `${filePath}: empty Evidence cell`);
        continue;
      }
      const tokens = cell
        .split('<br>')
        .map((token) => token.trim())
        .filter(Boolean);
      for (const token of tokens) {
        if (!EVIDENCE_TOKEN_RE.test(token)) {
          fail(errors, `${filePath}: invalid Evidence token "${token}"`);
        }
      }
    }
  }
}

function validateMermaid(errors, filePath, text) {
  const mermaidBlocks = text.match(/```mermaid[\s\S]*?```/g) || [];
  if (!mermaidBlocks.length) {
    fail(errors, `${filePath}: mermaid block not found`);
    return;
  }
  const ok = mermaidBlocks.some((block) => /graph\s+TD/.test(block));
  if (!ok) {
    fail(errors, `${filePath}: mermaid graph TD not found`);
  }
}

function validateJsonBlock(errors, filePath, text) {
  const match = text.match(/```json\s*([\s\S]*?)```/);
  if (!match) {
    fail(errors, `${filePath}: machine-readable JSON block not found`);
    return;
  }
  try {
    JSON.parse(match[1]);
  } catch (err) {
    fail(errors, `${filePath}: machine-readable JSON parse error (${err.message})`);
  }
}

function run() {
  const errors = [];
  for (const spec of REQUIRED_DOCS) {
    const filePath = path.join(KG_DIR, spec.file);
    if (!fs.existsSync(filePath)) {
      fail(errors, `${spec.file}: file missing`);
      continue;
    }
    const text = fs.readFileSync(filePath, 'utf8');
    const tables = parseTables(text);
    if (!tables.length) {
      fail(errors, `${spec.file}: markdown table not found`);
      continue;
    }
    ensureHeaders(errors, spec.file, tables, spec.headers);
    validateEvidenceCells(errors, spec.file, tables);
    if (spec.file === 'PROJECT_DATA_RELATION_MAP.md' || spec.file === 'PROJECT_DATA_SCHEMA_GRAPH.md') {
      validateMermaid(errors, spec.file, text);
    }
    if (spec.file === 'PROJECT_DATA_SCHEMA_GRAPH.md') {
      validateJsonBlock(errors, spec.file, text);
    }
  }

  if (errors.length) {
    console.error('[knowledge-graph] check failed');
    for (const row of errors) console.error(`- ${row}`);
    process.exit(1);
  }

  console.log('[knowledge-graph] check passed');
  console.log(`[knowledge-graph] validated docs: ${REQUIRED_DOCS.length}`);
}

run();
