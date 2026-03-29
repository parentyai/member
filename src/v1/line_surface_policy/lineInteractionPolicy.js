'use strict';

const { countUtf16Units, trimToUtf16Budget } = require('../line_renderer/utf16Budgeter');

const MAX_QUICK_REPLY_ITEMS = 4;
const MAX_QUICK_REPLY_LABEL_UTF16 = 20;
const MAX_QUICK_REPLY_TEXT_UTF16 = 60;
const MAX_TEMPLATE_ACTIONS = 4;
const FLEX_TEXT_THRESHOLD_UTF16 = 700;

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeQuickReplyCandidates(value) {
  const rows = Array.isArray(value) ? value : [];
  const out = [];
  rows.forEach((row) => {
    if (out.length >= MAX_QUICK_REPLY_ITEMS) return;
    const payload = row && typeof row === 'object' ? row : {};
    const label = trimToUtf16Budget(normalizeText(payload.label || payload.text), MAX_QUICK_REPLY_LABEL_UTF16);
    const text = trimToUtf16Budget(normalizeText(payload.text || payload.label), MAX_QUICK_REPLY_TEXT_UTF16);
    if (!label || !text) return;
    if (out.some((item) => item.label === label && item.text === text)) return;
    out.push({
      label,
      text,
      data: normalizeText(payload.data).slice(0, 120) || null
    });
  });
  return out;
}

function normalizeTemplateActionCandidates(value, fallbackQuickReplies) {
  const rows = Array.isArray(value) ? value : [];
  const quickReplies = Array.isArray(fallbackQuickReplies) ? fallbackQuickReplies : [];
  const out = [];

  rows.forEach((row) => {
    if (out.length >= MAX_TEMPLATE_ACTIONS) return;
    const payload = row && typeof row === 'object' ? row : {};
    const inferredType = normalizeText(
      payload.type || payload.actionType || (payload.uri || payload.url ? 'uri' : 'message')
    ).toLowerCase();
    const label = trimToUtf16Budget(
      normalizeText(payload.label || payload.text || payload.title),
      MAX_QUICK_REPLY_LABEL_UTF16
    );
    if (!label) return;
    if (inferredType === 'uri') {
      const uri = normalizeText(payload.uri || payload.url);
      if (!/^https?:\/\//i.test(uri)) return;
      if (out.some((item) => item.type === 'uri' && item.label === label && item.uri === uri)) return;
      out.push({ type: 'uri', label, uri });
      return;
    }
    const text = trimToUtf16Budget(normalizeText(payload.text || payload.label), MAX_QUICK_REPLY_TEXT_UTF16);
    if (!text) return;
    if (out.some((item) => item.type === 'message' && item.label === label && item.text === text)) return;
    out.push({
      type: 'message',
      label,
      text,
      data: normalizeText(payload.data).slice(0, 120) || null
    });
  });

  quickReplies.forEach((row) => {
    if (out.length >= MAX_TEMPLATE_ACTIONS) return;
    const label = trimToUtf16Budget(normalizeText(row && row.label), MAX_QUICK_REPLY_LABEL_UTF16);
    const text = trimToUtf16Budget(normalizeText(row && row.text), MAX_QUICK_REPLY_TEXT_UTF16);
    if (!label || !text) return;
    if (out.some((item) => item.type === 'message' && item.label === label && item.text === text)) return;
    out.push({
      type: 'message',
      label,
      text,
      data: normalizeText(row && row.data).slice(0, 120) || null
    });
  });

  return out;
}

function resolveLineSurfacePlan(payload) {
  const input = payload && typeof payload === 'object' ? payload : {};
  const text = normalizeText(input.text);
  const requestedSurface = normalizeText(input.requestedSurface || input.serviceSurface).toLowerCase();
  const needsHandoff = input.handoffRequired === true;
  const quickReplies = normalizeQuickReplyCandidates(input.quickReplies);
  const templateActions = normalizeTemplateActionCandidates(input.templateActions, quickReplies);
  const longText = countUtf16Units(text) > FLEX_TEXT_THRESHOLD_UTF16;
  const allowQuickReply = quickReplies.length > 0 && !needsHandoff;
  const allowTemplate = templateActions.length > 0 && !needsHandoff;
  let surface = 'text';
  let degradedFrom = null;
  let reason = 'default_text';

  if (needsHandoff && input.miniAppUrl) {
    surface = 'mini_app';
    reason = 'handoff_mini_app';
  } else if (needsHandoff && input.liffUrl) {
    surface = 'liff';
    reason = 'handoff_liff';
  } else if (requestedSurface === 'quick_reply') {
    if (allowQuickReply) {
      surface = 'quick_reply';
      reason = 'requested_quick_reply';
    } else {
      degradedFrom = 'quick_reply';
      surface = longText ? 'flex' : 'text';
      reason = quickReplies.length === 0 ? 'quick_reply_candidates_missing' : 'quick_reply_handoff_blocked';
    }
  } else if (requestedSurface === 'flex') {
    surface = 'flex';
    reason = 'requested_flex';
  } else if (requestedSurface === 'template') {
    if (allowTemplate) {
      surface = 'template';
      reason = 'requested_template';
    } else {
      degradedFrom = 'template';
      surface = longText ? 'flex' : 'text';
      reason = quickReplies.length === 0 ? 'template_actions_missing' : 'template_handoff_blocked';
    }
  } else if (allowQuickReply) {
    surface = 'quick_reply';
    reason = 'quick_reply_candidates_available';
  } else if (longText) {
    surface = 'flex';
    reason = 'long_text_flex';
  }

  return {
    surface,
    reason,
    degraded: degradedFrom !== null,
    degradedFrom,
    quickReplies,
    templateActions
  };
}

function selectLineSurface(payload) {
  return resolveLineSurfacePlan(payload).surface;
}

module.exports = {
  MAX_QUICK_REPLY_ITEMS,
  MAX_QUICK_REPLY_LABEL_UTF16,
  MAX_QUICK_REPLY_TEXT_UTF16,
  MAX_TEMPLATE_ACTIONS,
  FLEX_TEXT_THRESHOLD_UTF16,
  normalizeQuickReplyCandidates,
  normalizeTemplateActionCandidates,
  resolveLineSurfacePlan,
  selectLineSurface
};
