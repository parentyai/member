'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, '..', '..', '..', 'schemas', 'semantic_response_object.schema.json');

const ACTION_CLASSES = new Set(['lookup', 'draft', 'assist', 'human_only']);
const CONFIDENCE_BANDS = new Set(['HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']);
const HANDOFF_STATES = new Set(['NONE', 'OFFERED', 'REQUIRED', 'IN_PROGRESS', 'COMPLETED']);
const SERVICE_SURFACES = new Set(['text', 'quick_reply', 'flex', 'template', 'liff', 'mini_app', 'push', 'service_message']);
const PATH_TYPES = new Set(['fast', 'slow', 'unknown']);
const GROUP_PRIVACY_MODES = new Set(['direct', 'group_safe']);
const CITATION_FRESHNESS_STATUSES = new Set(['fresh', 'mixed', 'stale', 'unknown']);
const CITATION_READINESS_DECISIONS = new Set(['allow', 'hedged', 'clarify', 'refuse', 'unknown']);
const MAX_TASKS = 3;
const MAX_WARNINGS = 6;
const MAX_EVIDENCE_REFS = 6;
const MAX_FOLLOWUPS = 3;
const MAX_SCOPES = 6;
const MAX_CHUNKS = 6;
const MAX_QUICK_REPLIES = 4;
const DEFAULT_CONTRACT_VERSION = 'sro_v2';

function readSchema() {
  try {
    return JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  } catch (_err) {
    return null;
  }
}

const semanticResponseObjectSchema = readSchema();

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeTextOrNull(value, maxLength) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function normalizeArray(values, maxItems, maxLen) {
  if (!Array.isArray(values)) return [];
  const out = [];
  values.forEach((row) => {
    if (out.length >= maxItems) return;
    const text = normalizeText(row);
    if (!text) return;
    out.push(text.slice(0, maxLen));
  });
  return out;
}

function normalizeEnum(value, allowed, fallback, transform) {
  const normalized = normalizeText(value);
  if (!normalized) return fallback;
  const candidate = typeof transform === 'function' ? transform(normalized) : normalized;
  return allowed.has(candidate) ? candidate : fallback;
}

function normalizeIsoDatetime(value) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

function buildTaskIdFromTitle(title, index) {
  const base = normalizeText(title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
  return (base || `task_${index + 1}`).slice(0, 64);
}

function normalizeTask(task, index) {
  const payload = task && typeof task === 'object' ? task : {};
  const title = normalizeText(payload.title || payload.text || payload.label).slice(0, 200);
  if (!title) return null;
  return {
    task_id: normalizeText(payload.task_id || payload.taskId).slice(0, 64) || buildTaskIdFromTitle(title, index),
    title,
    status: normalizeText(payload.status).slice(0, 32) || 'suggested',
    priority: normalizeText(payload.priority).slice(0, 32) || 'medium',
    due_at: normalizeIsoDatetime(payload.due_at || payload.dueAt),
    required_docs: normalizeArray(payload.required_docs || payload.requiredDocs, 5, 120),
    blockers: normalizeArray(payload.blockers, 5, 160)
  };
}

function normalizeTasks(explicitTasks, fallbackNextSteps) {
  const out = [];
  const sourceTasks = Array.isArray(explicitTasks) ? explicitTasks : [];
  sourceTasks.forEach((task, index) => {
    if (out.length >= MAX_TASKS) return;
    const normalized = normalizeTask(task, index);
    if (normalized) out.push(normalized);
  });
  if (out.length > 0) return out;
  const nextSteps = normalizeArray(fallbackNextSteps, MAX_TASKS, 200);
  nextSteps.forEach((step, index) => {
    out.push({
      task_id: buildTaskIdFromTitle(step, index),
      title: step,
      status: 'suggested',
      priority: 'medium',
      due_at: null,
      required_docs: [],
      blockers: []
    });
  });
  return out;
}

function normalizeEvidenceRef(ref, index) {
  if (typeof ref === 'string') {
    const label = normalizeText(ref).slice(0, 200);
    if (!label) return null;
    return {
      ref_id: `evidence_${index + 1}`,
      label,
      source_snapshot_id: null,
      authority_tier: 'UNKNOWN',
      freshness_status: 'unknown',
      readiness_decision: 'unknown',
      disclosure_required: false,
      url: null
    };
  }
  const payload = ref && typeof ref === 'object' ? ref : {};
  const label = normalizeText(payload.label || payload.title || payload.text).slice(0, 200);
  const sourceSnapshotId = normalizeText(payload.source_snapshot_id || payload.sourceSnapshotId).slice(0, 120) || null;
  const url = normalizeText(payload.url).slice(0, 400) || null;
  if (!label && !sourceSnapshotId && !url) return null;
  return {
    ref_id: normalizeText(payload.ref_id || payload.refId).slice(0, 120) || `evidence_${index + 1}`,
    label: label || sourceSnapshotId || url,
    source_snapshot_id: sourceSnapshotId,
    authority_tier: normalizeText(payload.authority_tier || payload.authorityTier).slice(0, 64) || 'UNKNOWN',
    freshness_status: normalizeEnum(
      payload.freshness_status || payload.freshnessStatus,
      CITATION_FRESHNESS_STATUSES,
      'unknown',
      (value) => value.toLowerCase()
    ),
    readiness_decision: normalizeEnum(
      payload.readiness_decision || payload.readinessDecision,
      CITATION_READINESS_DECISIONS,
      'unknown',
      (value) => value.toLowerCase()
    ),
    disclosure_required: payload.disclosure_required === true || payload.disclosureRequired === true,
    url
  };
}

function normalizeEvidenceRefs(explicitRefs) {
  const refs = Array.isArray(explicitRefs) ? explicitRefs : [];
  const out = [];
  refs.forEach((ref, index) => {
    if (out.length >= MAX_EVIDENCE_REFS) return;
    const normalized = normalizeEvidenceRef(ref, index);
    if (normalized) out.push(normalized);
  });
  return out;
}

function normalizeQuickReply(row) {
  const payload = row && typeof row === 'object' ? row : {};
  const label = normalizeText(payload.label || payload.text).slice(0, 20);
  const text = normalizeText(payload.text || payload.label).slice(0, 60);
  if (!label || !text) return null;
  return {
    label,
    text,
    data: normalizeText(payload.data).slice(0, 120) || null
  };
}

function normalizeQuickReplies(value) {
  const rows = Array.isArray(value) ? value : [];
  const out = [];
  rows.forEach((row) => {
    if (out.length >= MAX_QUICK_REPLIES) return;
    const normalized = normalizeQuickReply(row);
    if (!normalized) return;
    const duplicate = out.some((item) => item.label === normalized.label && item.text === normalized.text);
    if (!duplicate) out.push(normalized);
  });
  return out;
}

function normalizeResponseChunks(value) {
  const rows = Array.isArray(value) ? value : [];
  const out = [];
  rows.forEach((row) => {
    if (out.length >= MAX_CHUNKS) return;
    const text = typeof row === 'string'
      ? normalizeText(row)
      : normalizeText(row && row.text);
    if (!text) return;
    out.push(text.slice(0, 800));
  });
  return out;
}

function firstNonEmptyLine(text) {
  const lines = normalizeText(text)
    .split('\n')
    .map((line) => normalizeText(line))
    .filter(Boolean);
  return lines[0] || '';
}

function deriveResponseChunks(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const fromMarkdown = normalizeText(payload.responseMarkdown)
    .split('\n')
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .slice(0, MAX_CHUNKS);
  if (fromMarkdown.length > 0) return fromMarkdown.map((line) => line.slice(0, 800));

  const chunks = [];
  const summary = normalizeText(payload.summary).slice(0, 800);
  if (summary) chunks.push(summary);
  (Array.isArray(payload.tasks) ? payload.tasks : []).slice(0, MAX_TASKS).forEach((task, index) => {
    const title = normalizeText(task && task.title).slice(0, 200);
    if (!title || chunks.length >= MAX_CHUNKS) return;
    chunks.push(`${index + 1}. ${title}`);
  });
  (Array.isArray(payload.warnings) ? payload.warnings : []).slice(0, 2).forEach((warning) => {
    if (chunks.length >= MAX_CHUNKS) return;
    chunks.push(`注意: ${normalizeText(warning).slice(0, 200)}`);
  });
  (Array.isArray(payload.followUps) ? payload.followUps : []).slice(0, 1).forEach((question) => {
    if (chunks.length >= MAX_CHUNKS) return;
    chunks.push(normalizeText(question).slice(0, 240));
  });
  const footer = normalizeText(payload.evidenceFooter).slice(0, 600);
  if (footer && chunks.length < MAX_CHUNKS) chunks.push(footer);
  return chunks;
}

function deriveResponseMarkdownFromCanonical(payload) {
  const chunks = deriveResponseChunks(payload);
  return chunks.join('\n').slice(0, 2000) || '回答を準備しています。';
}

function deriveEvidenceFooter(explicitFooter, evidenceRefs, citationSummary) {
  const footer = normalizeText(explicitFooter).slice(0, 600);
  if (footer) return footer;
  if (citationSummary && citationSummary.disclaimer_required === true) {
    return '根拠の鮮度または公的性に注意が必要です。公式窓口で最終確認してください。';
  }
  if (Array.isArray(evidenceRefs) && evidenceRefs.length > 0) {
    const labels = evidenceRefs
      .slice(0, 2)
      .map((item) => normalizeText(item && item.label))
      .filter(Boolean);
    if (labels.length > 0) {
      return `根拠: ${labels.join(' / ')}`.slice(0, 600);
    }
  }
  return null;
}

function normalizePolicyTrace(value) {
  const payload = value && typeof value === 'object' ? value : {};
  return {
    policy_source: normalizeText(payload.policy_source || payload.policySource).slice(0, 64) || 'system_flags',
    legal_decision: normalizeText(payload.legal_decision || payload.legalDecision).slice(0, 32) || 'allow',
    safety_gate: normalizeText(payload.safety_gate || payload.safetyGate).slice(0, 64) || 'default',
    disclosure_required: payload.disclosure_required === true || payload.disclosureRequired === true,
    escalation_required: payload.escalation_required === true || payload.escalationRequired === true,
    reason_codes: normalizeArray(payload.reason_codes || payload.reasonCodes, 8, 80)
  };
}

function resolveCitationFreshnessStatus(evidenceRefs) {
  const refs = Array.isArray(evidenceRefs) ? evidenceRefs : [];
  const statuses = Array.from(new Set(refs.map((row) => normalizeText(row && row.freshness_status).toLowerCase()).filter(Boolean)));
  if (statuses.length === 0) return 'unknown';
  if (statuses.every((status) => status === 'fresh')) return 'fresh';
  if (statuses.every((status) => status === 'stale')) return 'stale';
  return 'mixed';
}

function normalizeCitationSummary(value, evidenceRefs, warnings) {
  const payload = value && typeof value === 'object' ? value : {};
  const reasonWarnings = Array.isArray(warnings) ? warnings : [];
  const disclaimerRequired = payload.disclaimer_required === true
    || payload.disclaimerRequired === true
    || reasonWarnings.some((item) => /stale|official|disclaimer|clarify|refuse/i.test(normalizeText(item)));
  return {
    finalized: payload.finalized !== false,
    readiness_decision: normalizeEnum(
      payload.readiness_decision || payload.readinessDecision,
      CITATION_READINESS_DECISIONS,
      'unknown',
      (row) => row.toLowerCase()
    ),
    freshness_status: normalizeEnum(
      payload.freshness_status || payload.freshnessStatus || resolveCitationFreshnessStatus(evidenceRefs),
      CITATION_FRESHNESS_STATUSES,
      'unknown',
      (row) => row.toLowerCase()
    ),
    authority_satisfied: typeof payload.authority_satisfied === 'boolean'
      ? payload.authority_satisfied
      : (typeof payload.authoritySatisfied === 'boolean' ? payload.authoritySatisfied : null),
    disclaimer_required: disclaimerRequired
  };
}

function buildResponseContractFromCanonical(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const contract = payload.explicitContract && typeof payload.explicitContract === 'object'
    ? payload.explicitContract
    : {};
  const summary = normalizeText(contract.summary).slice(0, 800)
    || firstNonEmptyLine(payload.responseMarkdown)
    || firstNonEmptyLine((Array.isArray(payload.responseChunks) ? payload.responseChunks : []).join('\n'))
    || '回答を準備しています。';
  const nextSteps = normalizeArray(
    contract.next_steps,
    MAX_TASKS,
    200
  );
  const derivedNextSteps = nextSteps.length > 0
    ? nextSteps
    : (Array.isArray(payload.tasks) ? payload.tasks : [])
      .slice(0, MAX_TASKS)
      .map((task) => normalizeText(task && task.title).slice(0, 200))
      .filter(Boolean);
  const followupQuestions = Array.isArray(payload.followUps) ? payload.followUps : [];
  const warnings = Array.isArray(payload.warnings) ? payload.warnings : [];
  const citationSummary = payload.citationSummary && typeof payload.citationSummary === 'object'
    ? payload.citationSummary
    : null;
  return {
    style: normalizeText(contract.style).slice(0, 64)
      || normalizeText(payload.answerMode).slice(0, 64)
      || 'coach',
    intent: normalizeText(contract.intent).slice(0, 64)
      || normalizeText(payload.intent).slice(0, 64)
      || 'general',
    summary,
    next_steps: derivedNextSteps,
    pitfall: normalizeTextOrNull(contract.pitfall, 240),
    followup_question: normalizeTextOrNull(
      contract.followup_question || followupQuestions[0],
      240
    ),
    evidence_footer: deriveEvidenceFooter(contract.evidence_footer, payload.evidenceRefs, citationSummary),
    safety_notes: normalizeArray(contract.safety_notes, 3, 200).length > 0
      ? normalizeArray(contract.safety_notes, 3, 200)
      : normalizeArray(warnings, 3, 200)
  };
}

function sanitizeSemanticResponseObject(source) {
  const payload = source && typeof source === 'object' ? source : {};
  const explicitContract = payload.response_contract && typeof payload.response_contract === 'object'
    ? payload.response_contract
    : {};
  const explicitQuickReplies = payload.quick_replies || payload.quickReplies;
  const intent = normalizeText(payload.intent || explicitContract.intent).slice(0, 64) || 'general';
  const stage = normalizeText(payload.stage || payload.lifecycle_stage || payload.parentLifecycleStage).slice(0, 64) || 'unknown';
  const answerMode = normalizeText(payload.answer_mode || payload.answerMode || explicitContract.style).slice(0, 64) || 'answer';
  const warnings = normalizeArray(payload.warnings || explicitContract.safety_notes, MAX_WARNINGS, 200);
  const followUps = normalizeArray(
    payload.follow_up_questions || payload.followUpQuestions || (explicitContract.followup_question ? [explicitContract.followup_question] : []),
    MAX_FOLLOWUPS,
    240
  );
  const tasks = normalizeTasks(payload.tasks, explicitContract.next_steps);
  const evidenceRefs = normalizeEvidenceRefs(payload.evidence_refs || payload.evidenceRefs);
  const citationSummary = normalizeCitationSummary(payload.citation_summary || payload.citationSummary, evidenceRefs, warnings);
  const responseChunks = normalizeResponseChunks(payload.response_chunks || payload.responseChunks);
  const responseMarkdown = normalizeText(payload.response_markdown).slice(0, 2000);
  const derivedChunks = responseChunks.length > 0
    ? responseChunks
    : deriveResponseChunks({
        responseMarkdown,
        summary: explicitContract.summary,
        tasks,
        warnings,
        followUps,
        evidenceFooter: explicitContract.evidence_footer
      });
  const derivedMarkdown = responseMarkdown || deriveResponseMarkdownFromCanonical({
    responseMarkdown,
    summary: explicitContract.summary,
    tasks,
    warnings,
    followUps,
    evidenceFooter: explicitContract.evidence_footer
  });
  const quickReplies = normalizeQuickReplies(explicitQuickReplies);
  const serviceSurfaceFallback = quickReplies.length > 0 ? 'quick_reply' : 'text';
  const policyTrace = normalizePolicyTrace(payload.policy_trace || payload.policyTrace);
  const contractVersion = normalizeText(payload.contract_version || payload.contractVersion).slice(0, 32) || DEFAULT_CONTRACT_VERSION;
  const sanitized = {
    version: 'v1',
    contract_version: contractVersion,
    intent,
    stage,
    answer_mode: answerMode,
    action_class: normalizeEnum(payload.action_class || payload.actionClass, ACTION_CLASSES, 'assist', (value) => value.toLowerCase()),
    confidence_band: normalizeEnum(payload.confidence_band || payload.confidenceBand, CONFIDENCE_BANDS, 'UNKNOWN', (value) => value.toUpperCase()),
    tasks,
    warnings,
    evidence_refs: evidenceRefs,
    follow_up_questions: followUps,
    memory_read_scopes: normalizeArray(payload.memory_read_scopes || payload.memoryReadScopes, MAX_SCOPES, 64),
    memory_write_scopes: normalizeArray(payload.memory_write_scopes || payload.memoryWriteScopes, MAX_SCOPES, 64),
    handoff_state: normalizeEnum(payload.handoff_state || payload.handoffState, HANDOFF_STATES, 'NONE', (value) => value.toUpperCase()),
    service_surface: normalizeEnum(payload.service_surface || payload.serviceSurface, SERVICE_SURFACES, serviceSurfaceFallback, (value) => value.toLowerCase()),
    response_chunks: derivedChunks,
    response_markdown: derivedMarkdown,
    path_type: normalizeEnum(payload.path_type || payload.pathType, PATH_TYPES, 'slow', (value) => value.toLowerCase()),
    u_units: normalizeArray(payload.u_units || payload.uUnits, 12, 32),
    group_privacy_mode: normalizeEnum(
      payload.group_privacy_mode || payload.groupPrivacyMode,
      GROUP_PRIVACY_MODES,
      'direct',
      (value) => value.toLowerCase()
    ),
    quick_replies: quickReplies,
    policy_trace: policyTrace,
    citation_summary: citationSummary,
    tool_calls: Array.isArray(payload.tool_calls)
      ? payload.tool_calls
          .filter((item) => item && typeof item === 'object')
          .slice(0, 8)
          .map((item) => ({
            name: normalizeText(item.name).slice(0, 80),
            call_id: normalizeText(item.call_id).slice(0, 120),
            arguments: item.arguments && typeof item.arguments === 'object' ? item.arguments : {}
          }))
          .filter((item) => item.name && item.call_id)
      : []
  };
  sanitized.response_contract = buildResponseContractFromCanonical({
    explicitContract,
    intent: sanitized.intent,
    answerMode: sanitized.answer_mode,
    tasks: sanitized.tasks,
    warnings: sanitized.warnings,
    followUps: sanitized.follow_up_questions,
    evidenceRefs: sanitized.evidence_refs,
    responseChunks: sanitized.response_chunks,
    responseMarkdown: sanitized.response_markdown,
    citationSummary: sanitized.citation_summary
  });
  return sanitized;
}

function validateSemanticResponseObject(source) {
  const payload = sanitizeSemanticResponseObject(source);
  const errors = [];
  if (!payload.contract_version) errors.push('contract_version_required');
  if (!payload.intent) errors.push('intent_required');
  if (!payload.stage) errors.push('stage_required');
  if (!payload.answer_mode) errors.push('answer_mode_required');
  if (!ACTION_CLASSES.has(payload.action_class)) errors.push('action_class_invalid');
  if (!CONFIDENCE_BANDS.has(payload.confidence_band)) errors.push('confidence_band_invalid');
  if (!Array.isArray(payload.tasks)) errors.push('tasks_array_required');
  if (!Array.isArray(payload.warnings)) errors.push('warnings_array_required');
  if (!Array.isArray(payload.evidence_refs)) errors.push('evidence_refs_array_required');
  if (!Array.isArray(payload.follow_up_questions)) errors.push('follow_up_questions_array_required');
  if (!Array.isArray(payload.memory_read_scopes)) errors.push('memory_read_scopes_array_required');
  if (!Array.isArray(payload.memory_write_scopes)) errors.push('memory_write_scopes_array_required');
  if (!HANDOFF_STATES.has(payload.handoff_state)) errors.push('handoff_state_invalid');
  if (!SERVICE_SURFACES.has(payload.service_surface)) errors.push('service_surface_invalid');
  if (!Array.isArray(payload.response_chunks) || payload.response_chunks.length === 0) {
    errors.push('response_chunks_required');
  }
  if (!payload.response_markdown) errors.push('response_markdown_required');
  if (!PATH_TYPES.has(payload.path_type)) errors.push('path_type_invalid');
  if (!GROUP_PRIVACY_MODES.has(payload.group_privacy_mode)) errors.push('group_privacy_mode_invalid');
  if (!payload.response_contract.summary) errors.push('response_contract.summary_required');
  if (!payload.response_contract.style) errors.push('response_contract.style_required');
  if (!payload.response_contract.intent) errors.push('response_contract.intent_required');
  if (!Array.isArray(payload.response_contract.next_steps)) errors.push('response_contract.next_steps_array_required');
  if (payload.response_contract.next_steps.length > MAX_TASKS) errors.push('response_contract.next_steps_max_3');
  if (payload.response_contract.followup_question && payload.response_contract.followup_question.length > 240) {
    errors.push('response_contract.followup_question_too_long');
  }
  if (payload.response_contract.pitfall && payload.response_contract.pitfall.length > 240) {
    errors.push('response_contract.pitfall_too_long');
  }
  if (!Array.isArray(payload.quick_replies)) errors.push('quick_replies_array_required');
  return {
    ok: errors.length === 0,
    errors,
    value: payload
  };
}

function buildDeterministicFallbackSemanticResponseObject(input) {
  const text = normalizeText(input && input.text).slice(0, 800) || 'すみません。いま回答を整えています。';
  const followup = normalizeText(input && input.followupQuestion).slice(0, 240);
  return sanitizeSemanticResponseObject({
    version: 'v1',
    contract_version: DEFAULT_CONTRACT_VERSION,
    intent: normalizeText(input && input.intent).slice(0, 64) || 'general',
    stage: 'unknown',
    answer_mode: 'fallback',
    action_class: 'assist',
    confidence_band: 'LOW',
    tasks: [],
    warnings: ['deterministic_fallback_applied'],
    evidence_refs: [],
    follow_up_questions: followup ? [followup] : [],
    memory_read_scopes: [],
    memory_write_scopes: [],
    handoff_state: 'NONE',
    service_surface: 'text',
    response_chunks: [text],
    response_markdown: text,
    path_type: 'slow',
    u_units: ['U-17', 'U-18'],
    group_privacy_mode: 'direct',
    quick_replies: [],
    citation_summary: {
      finalized: true,
      readiness_decision: 'unknown',
      freshness_status: 'unknown',
      authority_satisfied: null,
      disclaimer_required: false
    },
    policy_trace: {
      policy_source: 'deterministic_fallback',
      legal_decision: 'allow',
      safety_gate: 'fallback',
      disclosure_required: false,
      escalation_required: false,
      reason_codes: ['deterministic_fallback_applied']
    },
    response_contract: {
      style: 'fallback',
      intent: normalizeText(input && input.intent).slice(0, 64) || 'general',
      summary: text,
      next_steps: [],
      pitfall: null,
      followup_question: followup || null,
      evidence_footer: null,
      safety_notes: ['deterministic_fallback_applied']
    },
    tool_calls: []
  });
}

function parseSemanticResponseObjectStrict(text, fallbackContext) {
  const raw = normalizeText(text);
  if (!raw) {
    return {
      ok: false,
      errors: ['empty_model_output'],
      value: buildDeterministicFallbackSemanticResponseObject(fallbackContext)
    };
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_err) {
    return {
      ok: false,
      errors: ['invalid_json_model_output'],
      value: buildDeterministicFallbackSemanticResponseObject(fallbackContext)
    };
  }
  const validated = validateSemanticResponseObject(parsed);
  if (!validated.ok) {
    return {
      ok: false,
      errors: validated.errors,
      value: buildDeterministicFallbackSemanticResponseObject(fallbackContext)
    };
  }
  return validated;
}

function toResponseMarkdown(sro) {
  const payload = sanitizeSemanticResponseObject(sro);
  return payload.response_markdown || deriveResponseMarkdownFromCanonical({
    responseMarkdown: payload.response_markdown,
    summary: payload.response_contract.summary,
    tasks: payload.tasks,
    warnings: payload.warnings,
    followUps: payload.follow_up_questions,
    evidenceFooter: payload.response_contract.evidence_footer
  });
}

module.exports = {
  DEFAULT_CONTRACT_VERSION,
  semanticResponseObjectSchema,
  sanitizeSemanticResponseObject,
  validateSemanticResponseObject,
  parseSemanticResponseObjectStrict,
  buildDeterministicFallbackSemanticResponseObject,
  toResponseMarkdown
};
