'use strict';

const { countUtf16Units, trimToUtf16Budget } = require('../line_renderer/utf16Budgeter');

const MAX_QUICK_REPLY_ITEMS = 4;
const MAX_QUICK_REPLY_LABEL_UTF16 = 20;
const MAX_QUICK_REPLY_TEXT_UTF16 = 60;
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

function resolveLineSurfacePlan(payload) {
  const input = payload && typeof payload === 'object' ? payload : {};
  const text = normalizeText(input.text);
  const requestedSurface = normalizeText(input.requestedSurface || input.serviceSurface).toLowerCase();
  const needsHandoff = input.handoffRequired === true;
  const quickReplies = normalizeQuickReplyCandidates(input.quickReplies);
  const longText = countUtf16Units(text) > FLEX_TEXT_THRESHOLD_UTF16;
  const allowQuickReply = quickReplies.length > 0 && !needsHandoff;
  const allowTemplate = quickReplies.length > 0 && !needsHandoff;
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
    quickReplies
  };
}

function selectLineSurface(payload) {
  return resolveLineSurfacePlan(payload).surface;
}

module.exports = {
  MAX_QUICK_REPLY_ITEMS,
  MAX_QUICK_REPLY_LABEL_UTF16,
  MAX_QUICK_REPLY_TEXT_UTF16,
  FLEX_TEXT_THRESHOLD_UTF16,
  normalizeQuickReplyCandidates,
  resolveLineSurfacePlan,
  selectLineSurface
};
