'use strict';

function summarizeSignal(signalKey, result) {
  const payload = result && typeof result === 'object' ? result : {};
  return {
    source: 'conversation_quality_evaluator',
    kind: 'signal_summary',
    refId: signalKey,
    traceId: null,
    createdAt: null,
    summary: `${signalKey}:${payload.status || 'unknown'}:${Number.isFinite(Number(payload.value)) ? Number(payload.value) : 0}`
  };
}

function summarizeIssueCandidate(issue) {
  return {
    source: 'conversation_quality_evaluator',
    kind: 'issue_candidate',
    refId: issue && issue.code ? issue.code : 'unknown_issue',
    traceId: null,
    createdAt: null,
    summary: issue && issue.code ? `${issue.code}:${issue.status || 'warn'}` : 'unknown_issue'
  };
}

function buildConversationQualityEvidence(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const reviewUnit = payload.reviewUnit && typeof payload.reviewUnit === 'object' ? payload.reviewUnit : {};
  const signalResults = payload.signalResults && typeof payload.signalResults === 'object' ? payload.signalResults : {};
  const issueCandidates = Array.isArray(payload.issueCandidates) ? payload.issueCandidates : [];
  const baseEvidence = Array.isArray(reviewUnit.evidenceRefs) ? reviewUnit.evidenceRefs : [];

  const signalEvidence = Object.keys(signalResults).map((signalKey) => summarizeSignal(signalKey, signalResults[signalKey]));
  const issueEvidence = issueCandidates.map((issue) => summarizeIssueCandidate(issue));

  return baseEvidence
    .concat(signalEvidence)
    .concat(issueEvidence)
    .slice(0, 12);
}

module.exports = {
  buildConversationQualityEvidence
};
