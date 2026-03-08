'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, '..', '..', '..', 'schemas', 'semantic_response_object.schema.json');

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

function sanitizeSemanticResponseObject(source) {
  const payload = source && typeof source === 'object' ? source : {};
  const contract = payload.response_contract && typeof payload.response_contract === 'object'
    ? payload.response_contract
    : {};

  return {
    version: 'v1',
    response_contract: {
      style: normalizeText(contract.style) || 'coach',
      intent: normalizeText(contract.intent) || 'general',
      summary: normalizeText(contract.summary).slice(0, 800),
      next_steps: normalizeArray(contract.next_steps, 3, 200),
      pitfall: normalizeText(contract.pitfall).slice(0, 240) || null,
      followup_question: normalizeText(contract.followup_question).slice(0, 240) || null,
      evidence_footer: normalizeText(contract.evidence_footer).slice(0, 600) || null,
      safety_notes: normalizeArray(contract.safety_notes, 3, 200)
    },
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
      : [],
    response_markdown: normalizeText(payload.response_markdown).slice(0, 2000) || null
  };
}

function validateSemanticResponseObject(source) {
  const payload = sanitizeSemanticResponseObject(source);
  const errors = [];
  if (!payload.response_contract.summary) errors.push('response_contract.summary_required');
  if (!payload.response_contract.style) errors.push('response_contract.style_required');
  if (!payload.response_contract.intent) errors.push('response_contract.intent_required');
  if (!Array.isArray(payload.response_contract.next_steps)) errors.push('response_contract.next_steps_array_required');
  if (payload.response_contract.next_steps.length > 3) errors.push('response_contract.next_steps_max_3');
  if (payload.response_contract.followup_question && payload.response_contract.followup_question.length > 240) {
    errors.push('response_contract.followup_question_too_long');
  }
  if (payload.response_contract.pitfall && payload.response_contract.pitfall.length > 240) {
    errors.push('response_contract.pitfall_too_long');
  }
  return {
    ok: errors.length === 0,
    errors,
    value: payload
  };
}

function buildDeterministicFallbackSemanticResponseObject(input) {
  const text = normalizeText(input && input.text).slice(0, 800) || 'すみません。いま回答を整えています。';
  const followup = normalizeText(input && input.followupQuestion).slice(0, 240);
  return {
    version: 'v1',
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
    tool_calls: [],
    response_markdown: null
  };
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
  const lines = [];
  lines.push(payload.response_contract.summary);
  payload.response_contract.next_steps.slice(0, 3).forEach((step, idx) => {
    lines.push(`${idx + 1}. ${step}`);
  });
  if (payload.response_contract.pitfall) {
    lines.push(`注意: ${payload.response_contract.pitfall}`);
  }
  if (payload.response_contract.followup_question) {
    lines.push(payload.response_contract.followup_question);
  }
  if (payload.response_contract.evidence_footer) {
    lines.push(payload.response_contract.evidence_footer);
  }
  return lines.filter(Boolean).join('\n');
}

module.exports = {
  semanticResponseObjectSchema,
  sanitizeSemanticResponseObject,
  validateSemanticResponseObject,
  parseSemanticResponseObjectStrict,
  buildDeterministicFallbackSemanticResponseObject,
  toResponseMarkdown
};
