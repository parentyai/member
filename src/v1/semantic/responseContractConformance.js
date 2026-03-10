'use strict';

const {
  sanitizeSemanticResponseObject,
  validateSemanticResponseObject,
  toResponseMarkdown
} = require('./semanticResponseObject');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeList(value, limit, maxLength) {
  const rows = Array.isArray(value) ? value : [];
  const max = Number.isFinite(Number(limit)) ? Math.max(0, Math.floor(Number(limit))) : 3;
  const maxLen = Number.isFinite(Number(maxLength)) ? Math.max(1, Math.floor(Number(maxLength))) : 200;
  const out = [];
  rows.forEach((item) => {
    if (out.length >= max) return;
    const normalized = normalizeText(item);
    if (!normalized) return;
    out.push(normalized.slice(0, maxLen));
  });
  return out;
}

function extractSummary(replyText) {
  const lines = normalizeText(replyText).split('\n').map((line) => normalizeText(line)).filter(Boolean);
  return lines.length ? lines[0].slice(0, 800) : '';
}

function extractFollowupQuestion(replyText) {
  const lines = normalizeText(replyText).split('\n').map((line) => normalizeText(line)).filter(Boolean);
  const candidate = lines.slice().reverse().find((line) => /[？?]$/.test(line));
  return candidate ? candidate.slice(0, 240) : null;
}

function extractNextSteps(replyText) {
  const lines = normalizeText(replyText).split('\n').map((line) => normalizeText(line)).filter(Boolean);
  const out = [];
  lines.forEach((line) => {
    if (out.length >= 3) return;
    const stripped = line
      .replace(/^\d+\.\s*/, '')
      .replace(/^[-・]\s*/, '')
      .trim();
    if (!stripped) return;
    if (/^(注意|根拠)[:：]/.test(stripped)) return;
    if (stripped.length < 3 || stripped.length > 200) return;
    if (/[？?]$/.test(stripped)) return;
    out.push(stripped);
  });
  return out.slice(0, 3);
}

function buildSemanticResponseObjectFromReply(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const replyText = normalizeText(payload.replyText || payload.text || '');
  const explicitSummary = normalizeText(payload.summary);
  const explicitNextSteps = normalizeList(payload.nextSteps || payload.next_actions, 3, 200);
  const explicitPitfall = normalizeText(payload.pitfall).slice(0, 240);
  const explicitFollowup = normalizeText(payload.followupQuestion || payload.followup_question).slice(0, 240);
  const explicitEvidenceFooter = normalizeText(payload.evidenceFooter || payload.evidence_footer).slice(0, 600);
  const summary = explicitSummary || extractSummary(replyText) || '回答を準備しています。';
  const nextSteps = explicitNextSteps.length ? explicitNextSteps : extractNextSteps(replyText);
  const followupQuestion = explicitFollowup || extractFollowupQuestion(replyText) || null;

  return sanitizeSemanticResponseObject({
    version: 'v1',
    response_contract: {
      style: normalizeText(payload.style || payload.conversationMode || 'coach') || 'coach',
      intent: normalizeText(payload.intent || payload.domainIntent || 'general') || 'general',
      summary,
      next_steps: nextSteps,
      pitfall: explicitPitfall || null,
      followup_question: followupQuestion,
      evidence_footer: explicitEvidenceFooter || null,
      safety_notes: normalizeList(payload.safetyNotes || payload.safety_notes, 3, 200)
    },
    tool_calls: [],
    response_markdown: replyText || null
  });
}

function evaluateResponseContractConformance(params) {
  const semanticResponseObject = buildSemanticResponseObjectFromReply(params);
  const validation = validateSemanticResponseObject(semanticResponseObject);
  const responseMarkdown = normalizeText(validation.value && validation.value.response_markdown)
    || toResponseMarkdown(validation.value);
  return {
    conformant: validation.ok === true,
    errors: Array.isArray(validation.errors) ? validation.errors : [],
    errorCount: Array.isArray(validation.errors) ? validation.errors.length : 0,
    semanticResponseObject: validation.value,
    responseMarkdown,
    fallbackApplied: validation.ok !== true
  };
}

module.exports = {
  buildSemanticResponseObjectFromReply,
  evaluateResponseContractConformance
};
