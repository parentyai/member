'use strict';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeList(values, maxItems) {
  const rows = Array.isArray(values) ? values : [];
  const out = [];
  rows.forEach((value) => {
    const text = normalizeText(value);
    if (!text) return;
    if (out.includes(text)) return;
    out.push(text);
  });
  return out.slice(0, maxItems);
}

function pickChecklistSummary(taskContent) {
  const checklist = Array.isArray(taskContent && taskContent.checklistItems)
    ? taskContent.checklistItems
    : [];
  const items = checklist
    .filter((item) => item && item.enabled !== false && normalizeText(item.text))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .map((item) => normalizeText(item.text))
    .slice(0, 5);
  return normalizeList(items, 5);
}

function splitCandidateLines(text, maxItems) {
  const raw = normalizeText(text);
  if (!raw) return [];
  const lines = raw
    .split(/\r?\n|。|\.|!/g)
    .map((line) => normalizeText(line))
    .filter(Boolean);
  return normalizeList(lines, maxItems);
}

function buildContextTips(task) {
  const row = task && typeof task === 'object' ? task : {};
  const tips = [];
  if (row.dueAt) {
    tips.push(`期限は ${String(row.dueAt).slice(0, 10)} です。逆算して準備してください。`);
  }
  if (row.status === 'doing') {
    tips.push('進行中タスクです。完了したら TODO完了 で状態を更新してください。');
  }
  if (row.blockedReason) {
    tips.push(`現在のブロック要因: ${String(row.blockedReason)}`);
  }
  if (!tips.length) {
    tips.push('不明点は失敗例を先に確認し、必要な書類を先に揃えてください。');
  }
  return normalizeList(tips, 5);
}

function generateTaskSummary(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const taskContent = payload.taskContent && typeof payload.taskContent === 'object'
    ? payload.taskContent
    : {};
  const task = payload.task && typeof payload.task === 'object' ? payload.task : {};

  const summaryShort = normalizeList(taskContent.summaryShort, 5);
  const topMistakes = normalizeList(taskContent.topMistakes, 3);
  const contextTips = normalizeList(taskContent.contextTips, 5);

  const fallbackSummary = pickChecklistSummary(taskContent).length
    ? pickChecklistSummary(taskContent)
    : splitCandidateLines(taskContent.manualText, 5);
  const fallbackMistakes = splitCandidateLines(taskContent.failureText, 3);
  const fallbackContextTips = buildContextTips(task);

  return {
    summaryShort: summaryShort.length ? summaryShort : fallbackSummary,
    topMistakes: topMistakes.length ? topMistakes : fallbackMistakes,
    contextTips: contextTips.length ? contextTips : fallbackContextTips
  };
}

module.exports = {
  generateTaskSummary
};
