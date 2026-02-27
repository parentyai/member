'use strict';

const fs = require('fs');
const path = require('path');

const MASTER_TABLE_DOC_PATH = path.resolve(__dirname, '..', '..', 'docs', 'SSOT_ADMIN_UI_MASTER_TABLE_V1.md');
const MASTER_TABLE_BEGIN = '<!-- ADMIN_UI_MASTER_TABLE_BEGIN -->';
const MASTER_TABLE_END = '<!-- ADMIN_UI_MASTER_TABLE_END -->';

let cachedRegistry = null;
let cachedMtimeMs = -1;

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonBlock(text, startMarker, endMarker, label) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`${label}_MARKERS_NOT_FOUND`);
  }
  const body = text.slice(start + startMarker.length, end).trim();
  return JSON.parse(body);
}

function ensureEnum(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new Error(`${label}_INVALID`);
  }
}

function validateFlow(flow, flowIndex) {
  const idx = `flows[${flowIndex}]`;
  if (!isObject(flow)) throw new Error(`${idx}_OBJECT_REQUIRED`);
  if (typeof flow.flowId !== 'string' || !flow.flowId.trim()) throw new Error(`${idx}.flowId_REQUIRED`);
  if (typeof flow.confirmMode !== 'string' || !flow.confirmMode.trim()) throw new Error(`${idx}.confirmMode_REQUIRED`);
  if (!isObject(flow.stateMachine)) throw new Error(`${idx}.stateMachine_OBJECT_REQUIRED`);
  if (!isObject(flow.guardRules)) throw new Error(`${idx}.guardRules_OBJECT_REQUIRED`);
  if (!Array.isArray(flow.writeActions) || flow.writeActions.length === 0) throw new Error(`${idx}.writeActions_ARRAY_REQUIRED`);
  if (!isObject(flow.evidenceBindings)) throw new Error(`${idx}.evidenceBindings_OBJECT_REQUIRED`);
  if (!isObject(flow.roleRestrictions)) throw new Error(`${idx}.roleRestrictions_OBJECT_REQUIRED`);

  ensureEnum(flow.confirmMode, ['required', 'warn_only'], `${idx}.confirmMode`);
  ensureEnum(flow.guardRules.actorMode, ['required', 'allow_fallback'], `${idx}.guardRules.actorMode`);
  ensureEnum(flow.guardRules.traceMode, ['required'], `${idx}.guardRules.traceMode`);
  ensureEnum(flow.guardRules.confirmMode, ['required', 'optional', 'none'], `${idx}.guardRules.confirmMode`);
  ensureEnum(flow.guardRules.killSwitchCheck, ['required', 'none'], `${idx}.guardRules.killSwitchCheck`);
  ensureEnum(flow.guardRules.auditMode, ['required'], `${idx}.guardRules.auditMode`);

  flow.writeActions.forEach((action, actionIndex) => {
    const actionIdx = `${idx}.writeActions[${actionIndex}]`;
    if (!isObject(action)) throw new Error(`${actionIdx}_OBJECT_REQUIRED`);
    if (typeof action.actionKey !== 'string' || !action.actionKey.trim()) throw new Error(`${actionIdx}.actionKey_REQUIRED`);
    if (typeof action.method !== 'string' || !action.method.trim()) throw new Error(`${actionIdx}.method_REQUIRED`);
    if (typeof action.pathPattern !== 'string' || !action.pathPattern.trim()) throw new Error(`${actionIdx}.pathPattern_REQUIRED`);
    if (typeof action.dangerClass !== 'string' || !action.dangerClass.trim()) throw new Error(`${actionIdx}.dangerClass_REQUIRED`);
    if (typeof action.handlerFile !== 'string' || !action.handlerFile.trim()) throw new Error(`${actionIdx}.handlerFile_REQUIRED`);
    if (action.workbenchZoneRequired !== true) throw new Error(`${actionIdx}.workbenchZoneRequired_TRUE_REQUIRED`);
  });
}

function validateMasterTable(table) {
  if (!isObject(table)) throw new Error('MASTER_TABLE_OBJECT_REQUIRED');
  if (typeof table.version !== 'string' || !table.version.trim()) throw new Error('MASTER_TABLE_VERSION_REQUIRED');
  if (!Array.isArray(table.flows) || table.flows.length === 0) throw new Error('MASTER_TABLE_FLOWS_REQUIRED');

  const flowIds = new Set();
  const actionKeys = new Set();
  const methodPathKeys = new Set();
  table.flows.forEach((flow, flowIndex) => {
    validateFlow(flow, flowIndex);
    if (flowIds.has(flow.flowId)) throw new Error(`DUPLICATE_FLOW_ID:${flow.flowId}`);
    flowIds.add(flow.flowId);
    flow.writeActions.forEach((action) => {
      if (actionKeys.has(action.actionKey)) throw new Error(`DUPLICATE_ACTION_KEY:${action.actionKey}`);
      actionKeys.add(action.actionKey);
      const methodPathKey = `${String(action.method).trim().toUpperCase()} ${String(action.pathPattern).trim()}`;
      if (methodPathKeys.has(methodPathKey)) throw new Error(`DUPLICATE_METHOD_PATH:${methodPathKey}`);
      methodPathKeys.add(methodPathKey);
    });
  });
}

function buildRegistry(table) {
  const flows = table.flows.map((flow) => Object.freeze({
    flowId: flow.flowId,
    confirmMode: flow.confirmMode,
    stateMachine: flow.stateMachine,
    guardRules: flow.guardRules,
    writeActions: flow.writeActions,
    evidenceBindings: flow.evidenceBindings,
    roleRestrictions: flow.roleRestrictions
  }));

  const flowById = Object.create(null);
  const actionByKey = Object.create(null);
  flows.forEach((flow) => {
    flowById[flow.flowId] = flow;
    flow.writeActions.forEach((action) => {
      actionByKey[action.actionKey] = Object.freeze(Object.assign({ flowId: flow.flowId }, action));
    });
  });

  return Object.freeze({
    version: table.version,
    flows: Object.freeze(flows),
    flowById: Object.freeze(flowById),
    actionByKey: Object.freeze(actionByKey)
  });
}

function loadManagedFlowTableFromDocs() {
  const stat = fs.statSync(MASTER_TABLE_DOC_PATH);
  if (cachedRegistry && cachedMtimeMs === stat.mtimeMs) {
    return cachedRegistry;
  }
  const text = fs.readFileSync(MASTER_TABLE_DOC_PATH, 'utf8');
  const table = parseJsonBlock(text, MASTER_TABLE_BEGIN, MASTER_TABLE_END, 'ADMIN_UI_MASTER_TABLE');
  validateMasterTable(table);
  cachedRegistry = buildRegistry(table);
  cachedMtimeMs = stat.mtimeMs;
  return cachedRegistry;
}

function getManagedFlowRegistry() {
  return loadManagedFlowTableFromDocs();
}

function getManagedFlowActionKeys() {
  const registry = getManagedFlowRegistry();
  return Object.keys(registry.actionByKey).sort();
}

function getManagedFlowDocPath() {
  return MASTER_TABLE_DOC_PATH;
}

module.exports = {
  MASTER_TABLE_BEGIN,
  MASTER_TABLE_END,
  loadManagedFlowTableFromDocs,
  getManagedFlowRegistry,
  getManagedFlowActionKeys,
  getManagedFlowDocPath
};
