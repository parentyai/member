'use strict';

const { buildLinkRegistryEntries, toEvidenceRefs } = require('./linkRegistry');
const { buildFaqCityPackContracts } = require('./faqCityPackResolver');
const { buildTaskMenuHints } = require('./buildTaskMenuHints');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeList(values, limit) {
  const rows = Array.isArray(values) ? values : [];
  const max = Number.isFinite(Number(limit)) ? Math.max(0, Math.floor(Number(limit))) : 3;
  const out = [];
  rows.forEach((row) => {
    if (out.length >= max) return;
    const normalized = normalizeText(row);
    if (!normalized) return;
    out.push(normalized);
  });
  return out;
}

function trimReplyText(value) {
  const text = normalizeText(value);
  if (!text) return '';
  return text.length > 1800 ? `${text.slice(0, 1800)}…` : text;
}

function extractLines(text) {
  return normalizeText(text).split('\n').map((line) => normalizeText(line)).filter(Boolean);
}

function extractAnswerSummary(text) {
  const lines = extractLines(text);
  if (!lines.length) return '状況を確認しました。';
  return lines[0].slice(0, 240);
}

function resolveResolutionState(payload) {
  const readinessDecision = normalizeText(payload.readinessDecision).toLowerCase();
  const lane = normalizeText(payload.lane).toLowerCase();
  if (lane === 'service_ack' || lane === 'welcome' || lane.includes('feedback')) return 'ack';
  if (readinessDecision === 'refuse') return 'refuse';
  if (readinessDecision === 'clarify') return 'clarify';
  if (payload.handoffRequired === true) return 'handoff_ready';
  if (normalizeText(payload.nextBestAction)) return 'actionable';
  return 'informing';
}

function resolveWhyItMatters(payload) {
  const faqOrPackContracts = Array.isArray(payload.faqOrPackContracts) ? payload.faqOrPackContracts : [];
  if (faqOrPackContracts.length > 0 && normalizeText(faqOrPackContracts[0].practical_meaning)) {
    return normalizeText(faqOrPackContracts[0].practical_meaning).slice(0, 240);
  }
  const dueNotes = normalizeList(payload.dueNotes, 3);
  if (dueNotes.length > 0) return '期限が近い手続きを先に固定すると、抜け漏れを減らしやすくなります。';
  const blockerNotes = normalizeList(payload.blockerNotes, 3);
  if (blockerNotes.length > 0) return '詰まり要因を先に外すと、このまま手続きを進めやすくなります。';
  const resolutionState = resolveResolutionState(payload);
  if (resolutionState === 'clarify') return '対象手続きと期限が定まると、案内を具体化できます。';
  if (resolutionState === 'refuse') return '制度確認が必要なので、公式情報を先に押さえるのが安全です。';
  if (Array.isArray(payload.officialLinks) && payload.officialLinks.length > 0) {
    return '必要な公式導線だけに絞っているので、次の行動へ移りやすいです。';
  }
  if (normalizeText(payload.nextBestAction)) {
    return '次の一手が明確だと、会話だけで止まらず手続きが前に進みます。';
  }
  return '';
}

function resolveSpecificityLevel(payload) {
  const nextBestAction = normalizeText(payload.nextBestAction);
  const officialLinks = Array.isArray(payload.officialLinks) ? payload.officialLinks : [];
  const topic = normalizeText(payload.topic);
  if (nextBestAction && officialLinks.length > 0 && topic) return 3;
  if (nextBestAction && topic) return 2;
  if (normalizeText(payload.answerSummary || payload.baseReplyText)) return 1;
  return 0;
}

function buildOfficialLinkSection(officialLinks) {
  const rows = Array.isArray(officialLinks) ? officialLinks : [];
  if (!rows.length) return '';
  return ['公式リンク:']
    .concat(rows.slice(0, 2).map((row) => `・${row.title}: ${row.url}`))
    .join('\n');
}

function buildResolutionResponse(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const nextSteps = normalizeList(payload.nextSteps, 3);
  const officialLinks = buildLinkRegistryEntries(payload.officialLinkCandidates, {
    topic: payload.topic || payload.domainIntent || 'general',
    jurisdiction: payload.jurisdiction || null,
    taskBinding: payload.taskBinding || null,
    menuBinding: payload.menuBinding || null,
    openSurface: 'text',
    fallbackIfUnavailable: 'リンクが開けない場合はメニューの「相談」から確認できます。'
  });
  const faqOrPackContracts = buildFaqCityPackContracts({
    faqCandidates: payload.faqCandidates,
    cityPackCandidates: payload.cityPackCandidates,
    officialLinks,
    topic: payload.topic || payload.domainIntent || 'general',
    jurisdiction: payload.jurisdiction || null,
    requiredDocs: payload.requiredDocs,
    dueNotes: payload.dueNotes,
    blockerNotes: payload.blockerNotes,
    taskBinding: payload.taskBinding || null,
    menuBinding: payload.menuBinding || null,
    stateConstraints: payload.stateConstraints
  });
  const answerSummary = normalizeText(payload.answerSummary) || extractAnswerSummary(payload.baseReplyText);
  const requiredDocs = normalizeList(payload.requiredDocs, 5);
  const dueNotes = normalizeList(payload.dueNotes, 3);
  const blockerNotes = normalizeList(payload.blockerNotes, 3);
  const nextBestAction = normalizeText(payload.nextBestAction || nextSteps[0]);
  const followUpQuestion = normalizeText(payload.followUpQuestion || payload.followupQuestion).slice(0, 240) || null;
  const resolutionState = resolveResolutionState(Object.assign({}, payload, { nextBestAction, officialLinks, faqOrPackContracts }));
  const whyItMatters = normalizeText(payload.whyItMatters) || resolveWhyItMatters({
    officialLinks,
    faqOrPackContracts,
    dueNotes,
    blockerNotes,
    nextBestAction,
    readinessDecision: payload.readinessDecision,
    lane: payload.lane
  });
  const hintBundle = buildTaskMenuHints({
    lane: payload.lane,
    topic: payload.topic || payload.domainIntent || 'general',
    jurisdiction: payload.jurisdiction || null,
    resolutionState,
    nextBestAction,
    taskable: payload.taskable === true || Boolean(nextBestAction),
    taskTitle: payload.taskTitle || nextBestAction,
    taskId: payload.taskId || null,
    taskStatus: payload.taskStatus || null,
    dueAt: payload.dueAt || null,
    dueNotes,
    dueClass: payload.dueClass || null,
    blockerNotes,
    blockerState: payload.blockerState || null,
    requiredDocs,
    menuBucketPreferred: payload.menuBucketPreferred || null
  });

  const sections = [answerSummary];
  if (whyItMatters) sections.push(`実務上の意味: ${whyItMatters}`);
  if (nextBestAction) sections.push(`次の一手: ${nextBestAction}`);
  if (requiredDocs.length > 0) sections.push(`必要書類: ${requiredDocs.join(' / ')}`);
  if (dueNotes.length > 0) sections.push(`期限メモ: ${dueNotes[0]}`);
  if (blockerNotes.length > 0) sections.push(`ブロッカー: ${blockerNotes[0]}`);
  const linkSection = buildOfficialLinkSection(officialLinks);
  if (linkSection) sections.push(linkSection);
  if (hintBundle.taskHint) sections.push(`タスク候補: ${hintBundle.taskHint.task_title}`);
  if (hintBundle.menuHint) sections.push(`メニュー: 「${hintBundle.menuHint.label}」`);
  if (followUpQuestion) sections.push(followUpQuestion);

  const safetyNotes = normalizeList(payload.safetyNotes, 3);
  const sourceFreshness = officialLinks.length > 0
    ? officialLinks[0].freshness_status || 'unknown'
    : (Number.isFinite(Number(payload.sourceFreshnessScore))
      ? (Number(payload.sourceFreshnessScore) >= 0.8 ? 'fresh' : (Number(payload.sourceFreshnessScore) >= 0.5 ? 'mixed' : 'stale'))
      : 'unknown');

  return {
    resolution_state: resolutionState,
    specificity_level: resolveSpecificityLevel({
      answerSummary,
      topic: payload.topic || payload.domainIntent || 'general',
      nextBestAction,
      officialLinks
    }),
    answer_summary: answerSummary,
    why_it_matters: whyItMatters || null,
    next_best_action: nextBestAction || null,
    official_links: officialLinks,
    required_docs: requiredDocs,
    due_notes: dueNotes,
    blocker_notes: blockerNotes,
    task_hint: hintBundle.taskHint,
    menu_hint: hintBundle.menuHint,
    follow_up_question: followUpQuestion,
    service_surface: hintBundle.serviceSurface,
    output_shape: 'resolution_response_v1',
    safety_notes: safetyNotes,
    source_freshness: sourceFreshness,
    faq_city_pack_results: faqOrPackContracts,
    replyText: trimReplyText(sections.join('\n\n')),
    nextSteps: nextBestAction ? [nextBestAction] : [],
    semanticTasks: hintBundle.semanticTasks,
    evidenceRefs: toEvidenceRefs(officialLinks, {
      readinessDecision: payload.readinessDecision || payload.sourceReadinessDecision || 'unknown',
      disclosureRequired: normalizeText(payload.readinessDecision).toLowerCase() !== 'allow'
    }),
    quickReplies: hintBundle.quickReplies
  };
}

module.exports = {
  buildResolutionResponse
};
