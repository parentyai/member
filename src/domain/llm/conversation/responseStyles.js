'use strict';

const STYLES = Object.freeze({
  QUICK: 'Quick',
  COACH: 'Coach',
  CHECKLIST: 'Checklist',
  CHOICE: 'Choice',
  DEBUG: 'Debug',
  TIMELINE: 'Timeline',
  WEEKEND: 'Weekend',
  STORY: 'Story'
});

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function sanitizeActions(actions, max) {
  const rows = Array.isArray(actions) ? actions : [];
  const cap = Number.isFinite(Number(max)) ? Math.max(0, Math.floor(Number(max))) : 3;
  const out = [];
  rows.forEach((row) => {
    const text = normalizeText(row);
    if (!text) return;
    if (out.includes(text)) return;
    if (out.length >= cap) return;
    out.push(text);
  });
  return out;
}

function numbered(actions) {
  if (!actions.length) return ['1. 手続きを1つだけ指定してください。'];
  return actions.map((action, index) => `${index + 1}. ${action}`);
}

function bulleted(actions) {
  if (!actions.length) return ['- まず対象手続きを1つ確定してください。'];
  return actions.map((action) => `- ${action}`);
}

function renderQuick(parts) {
  const lines = [parts.summary, 'まずこの順です。'];
  lines.push(...numbered(parts.nextActions));
  lines.push(`つまずきやすい点: ${parts.pitfall}`);
  if (parts.question) lines.push(`確認: ${parts.question}`);
  return lines.join('\n').trim();
}

function renderCoach(parts) {
  const lines = [parts.summary, 'この順で進めると迷いにくいです。'];
  lines.push(...bulleted(parts.nextActions));
  lines.push(`注意点: ${parts.pitfall}`);
  if (parts.question) lines.push(`確認したい点: ${parts.question}`);
  return lines.join('\n').trim();
}

function renderChecklist(parts) {
  const lines = [parts.summary, 'チェックリスト:'];
  const rows = parts.nextActions.length
    ? parts.nextActions.map((action) => `- [ ] ${action}`)
    : ['- [ ] 対象手続きを1つ決める'];
  lines.push(...rows);
  lines.push(`見落としやすい点: ${parts.pitfall}`);
  if (parts.question) lines.push(`確認事項: ${parts.question}`);
  return lines.join('\n').trim();
}

function renderChoice(parts) {
  const lines = [parts.summary, '進め方の候補です。'];
  const rows = parts.nextActions.length
    ? parts.nextActions.slice(0, 3).map((action, index) => `${String.fromCharCode(65 + index)}. ${action}`)
    : ['A. 対象手続きを1つ指定する'];
  lines.push(...rows);
  lines.push(`注意: ${parts.pitfall}`);
  if (parts.question) lines.push(`どれで進めますか: ${parts.question}`);
  return lines.join('\n').trim();
}

function renderDebug(parts) {
  const lines = [parts.summary, '切り分け手順:'];
  lines.push(...numbered(parts.nextActions));
  lines.push(`詰まりポイント: ${parts.pitfall}`);
  if (parts.question) lines.push(`追加確認: ${parts.question}`);
  return lines.join('\n').trim();
}

function renderTimeline(parts) {
  const lines = [parts.summary, 'タイムラインで整理します。'];
  lines.push(...numbered(parts.nextActions));
  lines.push(`遅れやすい点: ${parts.pitfall}`);
  if (parts.question) lines.push(`期限確認: ${parts.question}`);
  return lines.join('\n').trim();
}

function renderWeekend(parts) {
  const lines = [parts.summary, '候補は次の通りです。'];
  lines.push(...bulleted(parts.nextActions));
  lines.push(`よくある失敗: ${parts.pitfall}`);
  if (parts.question) lines.push(`好みに合わせる確認: ${parts.question}`);
  return lines.join('\n').trim();
}

function renderStory(parts) {
  const lines = [parts.summary, '順番に進めると詰まりにくいです。'];
  lines.push(...numbered(parts.nextActions));
  lines.push(`先に注意: ${parts.pitfall}`);
  if (parts.question) lines.push(`確認したいこと: ${parts.question}`);
  return lines.join('\n').trim();
}

function renderConversationStyle(styleId, params) {
  const payload = params && typeof params === 'object' ? params : {};
  const normalized = {
    summary: normalizeText(payload.summary) || '状況の特定に必要な情報が不足しています。',
    nextActions: sanitizeActions(payload.nextActions, payload.maxActions || 3),
    pitfall: normalizeText(payload.pitfall) || '手続き名と期限が曖昧なまま進めることです。',
    question: normalizeText(payload.question),
    maxActions: Number.isFinite(Number(payload.maxActions)) ? Number(payload.maxActions) : 3
  };

  switch (styleId) {
    case STYLES.QUICK:
      return renderQuick(normalized);
    case STYLES.COACH:
      return renderCoach(normalized);
    case STYLES.CHECKLIST:
      return renderChecklist(normalized);
    case STYLES.CHOICE:
      return renderChoice(normalized);
    case STYLES.DEBUG:
      return renderDebug(normalized);
    case STYLES.TIMELINE:
      return renderTimeline(normalized);
    case STYLES.WEEKEND:
      return renderWeekend(normalized);
    case STYLES.STORY:
      return renderStory(normalized);
    default:
      return renderCoach(normalized);
  }
}

module.exports = {
  STYLES,
  renderConversationStyle
};
