'use strict';

const journeyParamVersionsRepo = require('../../repos/firestore/journeyParamVersionsRepo');
const { resolveEffectiveJourneyParams } = require('./resolveEffectiveJourneyParams');

function normalizeStringList(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  values.forEach((item) => {
    if (typeof item !== 'string') return;
    const normalized = item.trim();
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

function detectGraphCycles(graph) {
  const payload = graph && typeof graph === 'object' ? graph : {};
  const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
  const edges = Array.isArray(payload.edges) ? payload.edges : [];
  const nodeKeys = new Set(nodes
    .map((node) => (node && typeof node.nodeKey === 'string' ? node.nodeKey.trim() : ''))
    .filter(Boolean));

  const adjacency = new Map();
  nodeKeys.forEach((nodeKey) => adjacency.set(nodeKey, []));

  const warnings = [];
  edges.forEach((edge) => {
    if (!edge || typeof edge !== 'object') return;
    if (edge.enabled === false) return;
    if (edge.required === false) return;
    const from = typeof edge.from === 'string' ? edge.from.trim() : '';
    const to = typeof edge.to === 'string' ? edge.to.trim() : '';
    if (!from || !to) return;
    if (!nodeKeys.has(to)) {
      warnings.push(`edge.to_missing_node:${from}->${to}`);
      return;
    }
    if (!nodeKeys.has(from)) {
      warnings.push(`edge.from_missing_node:${from}->${to}`);
      return;
    }
    adjacency.get(from).push(to);
  });

  const visited = new Set();
  const onStack = new Set();
  const path = [];
  const cycles = [];

  function walk(nodeKey) {
    if (onStack.has(nodeKey)) {
      const idx = path.indexOf(nodeKey);
      const cycle = idx >= 0 ? path.slice(idx).concat(nodeKey) : [nodeKey, nodeKey];
      const marker = cycle.join('>');
      if (!cycles.some((item) => item.join('>') === marker)) cycles.push(cycle);
      return;
    }
    if (visited.has(nodeKey)) return;
    visited.add(nodeKey);
    onStack.add(nodeKey);
    path.push(nodeKey);

    const next = adjacency.get(nodeKey) || [];
    next.forEach((to) => walk(to));

    path.pop();
    onStack.delete(nodeKey);
  }

  nodeKeys.forEach((nodeKey) => walk(nodeKey));
  return {
    cycles,
    warnings: normalizeStringList(warnings)
  };
}

function validateGuards(effective) {
  const errors = [];
  const warnings = [];
  const payload = effective && typeof effective === 'object' ? effective : {};
  const graph = payload.graph && typeof payload.graph === 'object' ? payload.graph : {};
  const journeyPolicy = payload.journeyPolicy && typeof payload.journeyPolicy === 'object' ? payload.journeyPolicy : {};
  const llmPolicy = payload.llmPolicy && typeof payload.llmPolicy === 'object' ? payload.llmPolicy : {};

  const freeCap = Number(graph.planUnlocks && graph.planUnlocks.free && graph.planUnlocks.free.maxNextActions);
  const proCap = Number(graph.planUnlocks && graph.planUnlocks.pro && graph.planUnlocks.pro.maxNextActions);
  if (Number.isFinite(freeCap) && (freeCap < 0 || freeCap > 3)) errors.push('graph.planUnlocks.free.maxNextActions must be within 0..3');
  if (Number.isFinite(proCap) && (proCap < 0 || proCap > 3)) errors.push('graph.planUnlocks.pro.maxNextActions must be within 0..3');

  const maxNextActions = Number(llmPolicy.output_constraints && llmPolicy.output_constraints.max_next_actions);
  if (Number.isFinite(maxNextActions) && (maxNextActions < 0 || maxNextActions > 3)) {
    errors.push('llmPolicy.output_constraints.max_next_actions must be within 0..3');
  }

  const globalDailyCap = Number(graph.ruleSet && graph.ruleSet.globalDailyCap);
  if (Number.isFinite(globalDailyCap) && (globalDailyCap < 0 || globalDailyCap > 100)) {
    errors.push('graph.ruleSet.globalDailyCap must be within 0..100');
  }

  const reminderMaxPerRun = Number(journeyPolicy.reminder_max_per_run);
  if (Number.isFinite(reminderMaxPerRun) && (reminderMaxPerRun < 1 || reminderMaxPerRun > 5000)) {
    errors.push('journeyPolicy.reminder_max_per_run must be within 1..5000');
  }

  const refusal = llmPolicy.refusal_strategy && typeof llmPolicy.refusal_strategy === 'object'
    ? llmPolicy.refusal_strategy
    : {};
  if (refusal.mode && !['suggest_and_consult', 'faq_only'].includes(String(refusal.mode))) {
    errors.push('llmPolicy.refusal_strategy.mode unsupported');
  }
  if (refusal.fallback && String(refusal.fallback) !== 'free_retrieval') {
    errors.push('llmPolicy.refusal_strategy.fallback must be free_retrieval');
  }

  if (Array.isArray(graph.nodes) && graph.nodes.length === 0) warnings.push('graph.nodes is empty');
  if (graph.enabled !== true) warnings.push('graph.enabled is false');
  if (llmPolicy.enabled !== true) warnings.push('llmPolicy.enabled is false');

  return {
    errors: normalizeStringList(errors),
    warnings: normalizeStringList(warnings)
  };
}

async function validateJourneyParamVersion(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const versionsRepo = resolvedDeps.journeyParamVersionsRepo || journeyParamVersionsRepo;

  const versionId = typeof payload.versionId === 'string' ? payload.versionId.trim() : '';
  if (!versionId) throw new Error('versionId required');

  const version = payload.version || await versionsRepo.getJourneyParamVersion(versionId);
  if (!version) throw new Error('journey_param_version_not_found');

  const resolved = await resolveEffectiveJourneyParams({
    versionId,
    lineUserId: payload.lineUserId || null
  }, resolvedDeps);

  const effective = resolved && resolved.effective && typeof resolved.effective === 'object'
    ? resolved.effective
    : {};
  const graph = effective.graph && typeof effective.graph === 'object' ? effective.graph : {};

  const cycleResult = detectGraphCycles(graph);
  const guardResult = validateGuards(effective);
  const errors = normalizeStringList(guardResult.errors.concat(cycleResult.cycles.length > 0 ? ['graph_cycle_detected'] : []));
  const warnings = normalizeStringList(guardResult.warnings.concat(cycleResult.warnings));
  const ok = errors.length === 0;

  return {
    ok,
    versionId,
    state: ok ? 'validated' : 'rejected',
    errors,
    warnings,
    cycleCount: cycleResult.cycles.length,
    cycles: cycleResult.cycles,
    validatedAt: new Date().toISOString(),
    effective
  };
}

module.exports = {
  validateJourneyParamVersion,
  detectGraphCycles
};
