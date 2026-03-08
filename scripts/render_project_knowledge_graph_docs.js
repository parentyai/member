'use strict';

const path = require('path');
const {
  KG_DIR,
  ensureDir,
  readJson,
  writeText,
  toTable
} = require('./knowledge_graph_common');

const INPUT_DATA_PATH = path.join(KG_DIR, 'project_knowledge_graph_data.json');

function evidenceCell(value) {
  const list = Array.isArray(value) ? value : [value];
  return list.map((row) => String(row || '').trim()).filter(Boolean).join('<br>');
}

function withMeta(title, payload, body) {
  const lines = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`- generatedAt: ${payload.generatedAt || 'UNOBSERVED_RUNTIME'}`);
  lines.push(`- gitCommit: ${payload.gitCommit || 'UNOBSERVED_RUNTIME'}`);
  lines.push(`- branch: ${payload.branch || 'UNOBSERVED_RUNTIME'}`);
  lines.push(`- sourceDigest: ${payload.sourceDigest || 'UNOBSERVED_RUNTIME'}`);
  lines.push(`- runtime.cloudRun: ${payload.runtimeStatus && payload.runtimeStatus.cloudRun ? payload.runtimeStatus.cloudRun : 'UNOBSERVED_RUNTIME'}`);
  lines.push(`- runtime.secretManager: ${payload.runtimeStatus && payload.runtimeStatus.secretManager ? payload.runtimeStatus.secretManager : 'UNOBSERVED_RUNTIME'}`);
  lines.push(`- runtime.firestore: ${payload.runtimeStatus && payload.runtimeStatus.firestore ? payload.runtimeStatus.firestore : 'UNOBSERVED_RUNTIME'}`);
  if (payload.runtimeReason) {
    lines.push(`- runtimeReason: ${payload.runtimeReason}`);
  }
  lines.push('');
  lines.push(body);
  lines.push('');
  return lines.join('\n');
}

function renderProjectScope(payload) {
  const rows = (payload.tables.PROJECT_SCOPE || []).map((row) => [
    row.layer,
    row.component,
    row.location,
    evidenceCell(row.evidence)
  ]);
  return toTable(['Layer', 'Component', 'Location', 'Evidence'], rows);
}

function renderEntityInventory(payload) {
  const rows = (payload.tables.ENTITY_INVENTORY || []).map((row) => [
    row.entity,
    row.storage,
    row.repoFile,
    row.purpose,
    evidenceCell(row.evidence)
  ]);
  return toTable(['Entity', 'Storage', 'Repo File', 'Purpose', 'Evidence'], rows);
}

function renderEntitySchema(payload) {
  const rows = (payload.tables.ENTITY_SCHEMA || []).map((row) => [
    row.entity,
    row.field,
    row.type,
    row.required,
    row.source,
    evidenceCell(row.evidence)
  ]);
  return toTable(['Entity', 'Field', 'Type', 'Required', 'Source', 'Evidence'], rows);
}

function renderEntityRelations(payload) {
  const rows = (payload.tables.ENTITY_RELATIONS || []).map((row) => [
    row.from,
    row.to,
    row.relation,
    evidenceCell(row.evidence)
  ]);
  return toTable(['From', 'To', 'Relation', 'Evidence'], rows);
}

function renderEntityApiMap(payload) {
  const rows = (payload.tables.ENTITY_API_MAP || []).map((row) => [
    row.entity,
    row.api,
    row.method,
    row.readWrite,
    evidenceCell(row.evidence)
  ]);
  return toTable(['Entity', 'API', 'Method', 'Read/Write', 'Evidence'], rows);
}

function renderStateMachine(payload) {
  const rows = (payload.tables.PROJECT_STATE_MACHINE_MAP || []).map((row) => [
    row.entity,
    row.state,
    row.transition,
    row.trigger,
    evidenceCell(row.evidence)
  ]);
  return toTable(['Entity', 'State', 'Transition', 'Trigger', 'Evidence'], rows);
}

function renderDataFlow(payload) {
  const rows = (payload.tables.DATA_FLOW || []).map((row) => [
    row.step,
    row.from,
    row.to,
    row.entity,
    row.action,
    evidenceCell(row.evidence)
  ]);
  return toTable(['Step', 'From', 'To', 'Entity', 'Action', 'Evidence'], rows);
}

function renderEventJobs(payload) {
  const rows = (payload.tables.PROJECT_EVENT_AND_JOB_MAP || []).map((row) => [
    row.job,
    row.trigger,
    row.entity,
    evidenceCell(row.evidence)
  ]);
  return toTable(['Job', 'Trigger', 'Entity', 'Evidence'], rows);
}

function renderPermissionMatrix(payload) {
  const rows = (payload.tables.PROJECT_PERMISSION_MATRIX || []).map((row) => [
    row.role,
    row.entity,
    row.action,
    evidenceCell(row.evidence)
  ]);
  return toTable(['Role', 'Entity', 'Action', 'Evidence'], rows);
}

function renderLlmDataFlow(payload) {
  const rows = (payload.tables.LLM_DATA_FLOW || []).map((row) => [
    row.input,
    row.output,
    row.entity,
    evidenceCell(row.evidence)
  ]);
  return toTable(['Input', 'Output', 'Entity', 'Evidence'], rows);
}

function renderSsotHierarchy(payload) {
  const rows = (payload.tables.PROJECT_SSOT_HIERARCHY || []).map((row) => [
    row.entity,
    row.canonical,
    row.derived,
    row.cache,
    evidenceCell(row.evidence)
  ]);
  return toTable(['Entity', 'Canonical', 'Derived', 'Cache', 'Evidence'], rows);
}

function renderAuditReconstruction(payload) {
  const rows = (payload.tables.AUDIT_RECONSTRUCTION_MAP || []).map((row) => [
    row.event,
    row.entity,
    row.trace,
    evidenceCell(row.evidence)
  ]);
  return toTable(['Event', 'Entity', 'Trace', 'Evidence'], rows);
}

function renderFailureRecovery(payload) {
  const rows = (payload.tables.PROJECT_FAILURE_RECOVERY_MAP || []).map((row) => [
    row.failure,
    row.recovery,
    evidenceCell(row.evidence)
  ]);
  return toTable(['Failure', 'Recovery', 'Evidence'], rows);
}

function renderInfraMap(payload) {
  const rows = (payload.tables.PROJECT_INFRA_MAP || []).map((row) => [
    row.component,
    row.dependency,
    evidenceCell(row.evidence)
  ]);
  const lines = [];
  lines.push('## Runtime Probe Runbook');
  lines.push('1. `gcloud auth login --update-adc`');
  lines.push('2. `gcloud auth application-default login`');
  lines.push('3. `npm run knowledge-graph:probe-runtime`');
  lines.push('');
  lines.push('If Firestore read fails, runtime rows are preserved with `UNOBSERVED_RUNTIME` and the error reason.');
  lines.push('');
  lines.push(toTable(['Component', 'Dependency', 'Evidence'], rows));
  return lines.join('\n');
}

function renderRetentionPii(payload) {
  const rows = (payload.tables.PROJECT_RETENTION_AND_PII_MAP || []).map((row) => [
    row.entity,
    row.retention,
    row.pii,
    row.delete,
    row.audit,
    evidenceCell(row.evidence)
  ]);
  return toTable(['Entity', 'Retention', 'PII', 'Delete', 'Audit', 'Evidence'], rows);
}

function renderHumanGraph(payload) {
  const edgeRows = (payload.graph && Array.isArray(payload.graph.edges)) ? payload.graph.edges : [];
  const graphTable = toTable(
    ['From', 'To', 'Relation', 'Evidence'],
    edgeRows.map((edge) => [
      edge.from,
      edge.to,
      edge.relation,
      evidenceCell(edge.evidence)
    ])
  );

  const lines = [];
  lines.push('## Overview');
  lines.push('This map explains the canonical project data path with City Pack vendor flow, notification generation, LLM boundaries, and evidence reconstruction anchors.');
  lines.push('');
  lines.push('## Graph');
  lines.push('```mermaid');
  lines.push(payload.graph && payload.graph.mermaid ? payload.graph.mermaid : 'graph TD\n  A["UNOBSERVED_RUNTIME"]');
  lines.push('```');
  lines.push('');
  lines.push('## Core Relations');
  lines.push(graphTable);
  lines.push('');
  lines.push('## Notes');
  lines.push('- Notification generation path is anchored by `osNotifications -> create/approve -> sendNotification -> notification_deliveries`.');
  lines.push('- City Pack and vendor linkage is anchored by `city_packs -> source_refs -> source_evidence -> city_pack_bulletins`.');
  lines.push('- LLM path is anchored by `buildLlmInputView -> llmClient -> faqAnswerLogs/llmUsageLogs`.');
  lines.push('- Trace reconstruction is anchored by `traceId` across webhook, audit_logs, decision_timeline, and delivery rows.');
  return lines.join('\n');
}

function renderAiGraph(payload) {
  const graph = payload.graph || {};
  const machine = {
    nodes: graph.nodes || [],
    edges: graph.edges || [],
    evidence: graph.evidenceRegistry || {}
  };

  const lines = [];
  lines.push('## Mermaid');
  lines.push('```mermaid');
  lines.push(graph.mermaid || 'graph TD\n  A["UNOBSERVED_RUNTIME"]');
  lines.push('```');
  lines.push('');
  lines.push('## Machine Readable');
  lines.push('```json');
  lines.push(JSON.stringify(machine, null, 2));
  lines.push('```');
  lines.push('');
  lines.push('## Evidence Index');
  const evidenceRows = Object.keys(machine.evidence || {})
    .sort((a, b) => a.localeCompare(b))
    .map((id) => [id, machine.evidence[id]]);
  lines.push(toTable(['Evidence ID', 'Evidence'], evidenceRows));
  return lines.join('\n');
}

function writeDoc(fileName, title, payload, bodyRenderer) {
  const docPath = path.join(KG_DIR, fileName);
  const body = bodyRenderer(payload);
  const text = withMeta(title, payload, body);
  writeText(docPath, `${text.trim()}\n`);
  return docPath;
}

function run() {
  ensureDir(KG_DIR);
  const payload = readJson(INPUT_DATA_PATH, null);
  if (!payload || typeof payload !== 'object') {
    throw new Error(`knowledge graph data missing: ${INPUT_DATA_PATH}`);
  }

  const generated = [];
  generated.push(writeDoc('PROJECT_SCOPE.md', 'PROJECT_SCOPE', payload, renderProjectScope));
  generated.push(writeDoc('ENTITY_INVENTORY.md', 'ENTITY_INVENTORY', payload, renderEntityInventory));
  generated.push(writeDoc('ENTITY_SCHEMA.md', 'ENTITY_SCHEMA', payload, renderEntitySchema));
  generated.push(writeDoc('ENTITY_RELATIONS.md', 'ENTITY_RELATIONS', payload, renderEntityRelations));
  generated.push(writeDoc('ENTITY_API_MAP.md', 'ENTITY_API_MAP', payload, renderEntityApiMap));
  generated.push(writeDoc('PROJECT_STATE_MACHINE_MAP.md', 'PROJECT_STATE_MACHINE_MAP', payload, renderStateMachine));
  generated.push(writeDoc('DATA_FLOW.md', 'DATA_FLOW', payload, renderDataFlow));
  generated.push(writeDoc('PROJECT_EVENT_AND_JOB_MAP.md', 'PROJECT_EVENT_AND_JOB_MAP', payload, renderEventJobs));
  generated.push(writeDoc('PROJECT_PERMISSION_MATRIX.md', 'PROJECT_PERMISSION_MATRIX', payload, renderPermissionMatrix));
  generated.push(writeDoc('LLM_DATA_FLOW.md', 'LLM_DATA_FLOW', payload, renderLlmDataFlow));
  generated.push(writeDoc('PROJECT_SSOT_HIERARCHY.md', 'PROJECT_SSOT_HIERARCHY', payload, renderSsotHierarchy));
  generated.push(writeDoc('AUDIT_RECONSTRUCTION_MAP.md', 'AUDIT_RECONSTRUCTION_MAP', payload, renderAuditReconstruction));
  generated.push(writeDoc('PROJECT_FAILURE_RECOVERY_MAP.md', 'PROJECT_FAILURE_RECOVERY_MAP', payload, renderFailureRecovery));
  generated.push(writeDoc('PROJECT_INFRA_MAP.md', 'PROJECT_INFRA_MAP', payload, renderInfraMap));
  generated.push(writeDoc('PROJECT_RETENTION_AND_PII_MAP.md', 'PROJECT_RETENTION_AND_PII_MAP', payload, renderRetentionPii));
  generated.push(writeDoc('PROJECT_DATA_RELATION_MAP.md', 'PROJECT_DATA_RELATION_MAP', payload, renderHumanGraph));
  generated.push(writeDoc('PROJECT_DATA_SCHEMA_GRAPH.md', 'PROJECT_DATA_SCHEMA_GRAPH', payload, renderAiGraph));

  console.log(`[knowledge-graph] docs rendered: ${generated.length}`);
}

run();
