'use strict';

const crypto = require('node:crypto');
const { resolveAudienceView } = require('./resolveAudienceView');

function buildKey(parts) {
  return `qpb_${crypto.createHash('sha256').update(parts.join('|'), 'utf8').digest('hex').slice(0, 16)}`;
}

function titleForCode(code) {
  const normalized = typeof code === 'string' ? code.trim().toLowerCase() : '';
  if (normalized === 'transcript_not_reviewable') return 'Transcript review is blocked';
  if (normalized === 'missing_user_message') return 'User message evidence is missing';
  if (normalized === 'missing_assistant_reply') return 'Assistant reply evidence is missing';
  if (normalized === 'missing_prior_context_summary') return 'Prior context evidence is missing';
  if (normalized === 'missing_trace_evidence') return 'Trace evidence is missing';
  if (normalized === 'missing_action_log_evidence') return 'LLM action evidence is missing';
  if (normalized === 'missing_faq_evidence') return 'FAQ evidence is missing';
  if (normalized === 'insufficient_context_for_followup_judgement') return 'Follow-up judgement is blocked by missing context';
  if (normalized === 'insufficient_knowledge_signals') return 'Knowledge judgement is blocked by missing signals';
  if (normalized === 'insufficient_trace_evidence') return 'Trace-backed judgement is blocked';
  return normalized ? normalized.replace(/_/g, ' ') : 'Observation blocker';
}

function actionForCode(code) {
  const normalized = typeof code === 'string' ? code.trim().toLowerCase() : '';
  if (normalized.includes('transcript') || normalized.includes('message') || normalized.includes('reply')) {
    return 'Increase transcript coverage before promoting runtime fixes.';
  }
  if (normalized.includes('context') || normalized.includes('followup')) {
    return 'Collect prior-context evidence before judging follow-up quality.';
  }
  if (normalized.includes('knowledge')) {
    return 'Collect candidate and evidence telemetry before judging knowledge usage.';
  }
  if (normalized.includes('trace')) {
    return 'Recover trace-join evidence before attributing runtime causes.';
  }
  return 'Resolve observation coverage gaps before opening runtime-quality repairs.';
}

function pushGroup(grouped, blocker, slice) {
  const code = blocker && blocker.code ? String(blocker.code).trim() : 'observation_gap';
  const key = code;
  if (!grouped.has(key)) {
    grouped.set(key, {
      blockerKey: buildKey([code]),
      code,
      title: titleForCode(code),
      summaries: [],
      affectedSlices: [],
      recommendedAction: actionForCode(code)
    });
  }
  const row = grouped.get(key);
  if (typeof blocker.message === 'string' && blocker.message.trim() && !row.summaries.includes(blocker.message.trim())) {
    row.summaries.push(blocker.message.trim());
  }
  if (slice && !row.affectedSlices.includes(slice)) row.affectedSlices.push(slice);
}

function serializePatrolObservationBlockers(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const audience = resolveAudienceView(payload.audience);
  const grouped = new Map();

  (Array.isArray(payload.rootCauseReports) ? payload.rootCauseReports : []).forEach((report) => {
    (Array.isArray(report && report.observationBlockers) ? report.observationBlockers : []).forEach((blocker) => {
      pushGroup(grouped, blocker, report && report.slice ? report.slice : null);
    });
  });

  (Array.isArray(payload.planObservationBlockers) ? payload.planObservationBlockers : []).forEach((blocker) => {
    pushGroup(grouped, blocker, null);
  });

  (Array.isArray(payload.issues) ? payload.issues : []).forEach((issue) => {
    if (!issue || issue.issueType !== 'observation_blocker') return;
    (Array.isArray(issue.observationBlockers) ? issue.observationBlockers : []).forEach((blocker) => {
      pushGroup(grouped, blocker, issue.slice && issue.slice !== 'global' ? issue.slice : null);
    });
  });

  return Array.from(grouped.values())
    .map((item) => ({
      blockerKey: item.blockerKey,
      title: audience === 'human' ? `まだ断定できない理由: ${item.title}` : item.title,
      summary: audience === 'human'
        ? (item.summaries[0] || '観測証跡が不足しているため、改善の断定は保留です。')
        : (item.summaries[0] || `${item.code} is blocking confident analysis.`),
      affectedSlices: item.affectedSlices.sort((left, right) => left.localeCompare(right, 'ja')),
      recommendedAction: item.recommendedAction
    }))
    .sort((left, right) => left.title.localeCompare(right.title, 'ja'));
}

module.exports = {
  serializePatrolObservationBlockers
};
