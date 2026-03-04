'use strict';

const journeyTemplatesRepo = require('../../repos/firestore/journeyTemplatesRepo');

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function toIso(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1000000000000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    const parsed = Date.parse(text);
    if (!Number.isFinite(parsed)) return null;
    return new Date(parsed).toISOString();
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString();
  }
  return null;
}

function toIsoDate(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  const iso = toIso(value);
  return iso ? iso.slice(0, 10) : null;
}

function shiftIsoDays(isoDate, deltaDays) {
  const baseMs = Date.parse(`${isoDate}T09:00:00.000Z`);
  if (!Number.isFinite(baseMs)) return null;
  return new Date(baseMs + (deltaDays * DAY_MS)).toISOString();
}

function resolveMeaning(step) {
  const meaning = step && step.meaning && typeof step.meaning === 'object' ? step.meaning : null;
  if (!meaning) return null;
  const normalized = {
    meaningKey: normalizeText(meaning.meaningKey, null),
    title: normalizeText(meaning.title, null),
    summary: normalizeText(meaning.summary, null),
    doneDefinition: normalizeText(meaning.doneDefinition, null),
    whyNow: normalizeText(meaning.whyNow, null),
    helpLinkRegistryIds: Array.isArray(meaning.helpLinkRegistryIds)
      ? meaning.helpLinkRegistryIds.map((item) => normalizeText(item, '')).filter(Boolean).slice(0, 3)
      : [],
    opsNotes: normalizeText(meaning.opsNotes, null)
  };
  if (!normalized.meaningKey && !normalized.title && !normalized.summary && !normalized.doneDefinition && !normalized.whyNow && !normalized.helpLinkRegistryIds.length && !normalized.opsNotes) {
    return null;
  }
  return normalized;
}

function buildTodoKey(templateId, phaseKey, stepKey) {
  const t = normalizeText(templateId, '');
  const p = normalizeText(phaseKey, '').toLowerCase();
  const s = normalizeText(stepKey, '');
  if (!t || !p || !s) return '';
  return `${t}__${p}__${s}`;
}

function selectAnchorDate(phaseKey, schedule) {
  const departureDate = toIsoDate(schedule && schedule.departureDate);
  const assignmentDate = toIsoDate(schedule && schedule.assignmentDate);
  const phase = normalizeText(phaseKey, '').toLowerCase();
  if (phase === 'in_assignment') return assignmentDate || departureDate;
  if (phase === 'offboarding') return departureDate || assignmentDate;
  return departureDate || assignmentDate;
}

function resolveDueAtFromStep(phaseKey, step, schedule) {
  const leadTime = step && step.leadTime && typeof step.leadTime === 'object' ? step.leadTime : null;
  if (!leadTime) return null;
  const days = Number.isFinite(Number(leadTime.days)) ? Math.max(0, Math.floor(Number(leadTime.days))) : 0;
  const anchorDate = selectAnchorDate(phaseKey, schedule);
  if (!anchorDate) return null;

  if (leadTime.kind === 'before_deadline') {
    const dueAt = shiftIsoDays(anchorDate, -days);
    if (!dueAt) return null;
    return { dueDate: dueAt.slice(0, 10), dueAt };
  }

  if (leadTime.kind === 'after') {
    // legacy TODOの体験整合のため、onboardingは出発前準備として逆算、他phaseは順算する
    const phase = normalizeText(phaseKey, '').toLowerCase();
    const deltaDays = phase === 'onboarding' ? -days : days;
    const dueAt = shiftIsoDays(anchorDate, deltaDays);
    if (!dueAt) return null;
    return { dueDate: dueAt.slice(0, 10), dueAt };
  }

  return null;
}

function normalizeDependsOnRef(value) {
  const normalized = normalizeText(value, '');
  if (!normalized) return null;
  if (normalized.includes('__')) return { kind: 'ruleId', value: normalized };
  if (normalized.includes('/')) {
    const parts = normalized.split('/').map((item) => item.trim()).filter(Boolean);
    if (parts.length === 2) return { kind: 'phase_step', phaseKey: parts[0], stepKey: parts[1] };
  }
  if (normalized.includes(':')) {
    const parts = normalized.split(':').map((item) => item.trim()).filter(Boolean);
    if (parts.length === 2) return { kind: 'phase_step', phaseKey: parts[0], stepKey: parts[1] };
  }
  return { kind: 'stepKey', value: normalized };
}

function resolveDependsOnTodoKeys(dependsOn, lookup) {
  const refs = Array.isArray(dependsOn) ? dependsOn : [];
  const resolved = [];
  refs.forEach((depRaw) => {
    const ref = normalizeDependsOnRef(depRaw);
    if (!ref) return;
    if (ref.kind === 'ruleId') {
      const todoKey = lookup.byRuleId.get(ref.value) || null;
      if (todoKey && !resolved.includes(todoKey)) resolved.push(todoKey);
      return;
    }
    if (ref.kind === 'phase_step') {
      const key = `${normalizeText(ref.phaseKey, '').toLowerCase()}::${normalizeText(ref.stepKey, '')}`;
      const todoKey = lookup.byPhaseStep.get(key) || null;
      if (todoKey && !resolved.includes(todoKey)) resolved.push(todoKey);
      return;
    }
    const candidates = lookup.byStepKey.get(ref.value) || [];
    if (candidates.length === 1 && !resolved.includes(candidates[0])) resolved.push(candidates[0]);
  });
  return resolved;
}

function compareDerivedTodo(left, right) {
  const dueLeft = Date.parse(left && left.dueAt ? left.dueAt : '') || Number.MAX_SAFE_INTEGER;
  const dueRight = Date.parse(right && right.dueAt ? right.dueAt : '') || Number.MAX_SAFE_INTEGER;
  if (dueLeft !== dueRight) return dueLeft - dueRight;
  return String(left && left.todoKey || '').localeCompare(String(right && right.todoKey || ''), 'ja');
}

async function deriveLegacyTodosFromTemplates(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const templateRepo = resolvedDeps.journeyTemplatesRepo || journeyTemplatesRepo;
  const schedule = payload.schedule && typeof payload.schedule === 'object' ? payload.schedule : {};
  const country = normalizeText(payload.country, 'US').toUpperCase();
  const now = toIso(payload.now) || new Date().toISOString();

  const templates = Array.isArray(payload.templates)
    ? payload.templates
    : await templateRepo.listEnabledJourneyTemplatesNow({ country, now }).catch(() => []);
  const list = Array.isArray(templates) ? templates : [];
  if (!list.length) return [];

  const todoCandidates = [];
  const lookup = {
    byRuleId: new Map(),
    byPhaseStep: new Map(),
    byStepKey: new Map()
  };

  list.forEach((template) => {
    const templateId = normalizeText(template && template.templateId, '');
    const templateVersion = Number.isFinite(Number(template && template.version)) ? Number(template.version) : 1;
    const phases = Array.isArray(template && template.phases) ? template.phases : [];
    phases.forEach((phase) => {
      const phaseKey = normalizeText(phase && phase.phaseKey, '').toLowerCase();
      const steps = Array.isArray(phase && phase.steps) ? phase.steps : [];
      steps.forEach((step) => {
        if (!step || step.enabled === false) return;
        const stepKey = normalizeText(step.stepKey, '');
        if (!stepKey) return;
        const due = resolveDueAtFromStep(phaseKey, step, schedule);
        if (!due) return;
        const todoKey = buildTodoKey(templateId, phaseKey, stepKey);
        if (!todoKey) return;
        const meaning = resolveMeaning(step);
        const title = normalizeText(meaning && meaning.title, normalizeText(step.title, stepKey));
        const candidate = {
          todoKey,
          title,
          dueDate: due.dueDate,
          dueAt: due.dueAt,
          phaseKey,
          stepKey,
          dependsOnRaw: Array.isArray(step.dependsOn) ? step.dependsOn : [],
          blocks: [],
          priority: Number.isFinite(Number(step.priority)) ? Number(step.priority) : 3,
          riskLevel: normalizeText(step.riskLevel, 'medium'),
          sourceTemplateVersion: `journey_template:${templateId}@${templateVersion}`,
          meaningKey: normalizeText(meaning && meaning.meaningKey, stepKey),
          meaning,
          whyNow: normalizeText(meaning && meaning.whyNow, null),
          doneDefinition: normalizeText(meaning && meaning.doneDefinition, null)
        };
        todoCandidates.push(candidate);
        const ruleId = buildTodoKey(templateId, phaseKey, stepKey);
        lookup.byRuleId.set(ruleId, todoKey);
        lookup.byPhaseStep.set(`${phaseKey}::${stepKey}`, todoKey);
        const existingByStep = lookup.byStepKey.get(stepKey) || [];
        if (!existingByStep.includes(todoKey)) existingByStep.push(todoKey);
        lookup.byStepKey.set(stepKey, existingByStep);
      });
    });
  });

  const deduped = [];
  const seenTodoKeys = new Set();
  todoCandidates.sort(compareDerivedTodo).forEach((candidate) => {
    if (!candidate || seenTodoKeys.has(candidate.todoKey)) return;
    seenTodoKeys.add(candidate.todoKey);
    deduped.push(Object.assign({}, candidate, {
      dependsOn: resolveDependsOnTodoKeys(candidate.dependsOnRaw, lookup)
    }));
  });

  return deduped.map((candidate) => {
    const copy = Object.assign({}, candidate);
    delete copy.dependsOnRaw;
    return copy;
  });
}

module.exports = {
  deriveLegacyTodosFromTemplates
};
