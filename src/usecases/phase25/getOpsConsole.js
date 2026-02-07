'use strict';

const decisionLogsRepo = require('../../repos/firestore/decisionLogsRepo');
const { getUserStateSummary } = require('../phase5/getUserStateSummary');
const { getMemberSummary } = require('../phase6/getMemberSummary');
const { evaluateOverallDecisionReadiness } = require('../phase24/overallDecisionReadiness');

function requireString(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} required`);
  if (value.trim().length === 0) throw new Error(`${label} required`);
  return value.trim();
}

function buildReadiness(summary, evaluator) {
  const checklistCompleteness = summary && summary.checklist ? summary.checklist.completeness : null;
  return evaluator({
    registrationCompleteness: summary ? summary.registrationCompleteness : null,
    userSummaryCompleteness: summary ? summary.userSummaryCompleteness : null,
    notificationSummaryCompleteness: null,
    checklistCompleteness,
    opsStateCompleteness: summary ? summary.opsStateCompleteness : null,
    opsDecisionCompleteness: summary ? summary.opsDecisionCompleteness : null
  });
}

async function getOpsConsole(params, deps) {
  const payload = params || {};
  const lineUserId = requireString(payload.lineUserId, 'lineUserId');

  const userSummaryFn = deps && deps.getUserStateSummary ? deps.getUserStateSummary : getUserStateSummary;
  const memberSummaryFn = deps && deps.getMemberSummary ? deps.getMemberSummary : getMemberSummary;
  const readinessFn = deps && deps.evaluateOverallDecisionReadiness
    ? deps.evaluateOverallDecisionReadiness
    : evaluateOverallDecisionReadiness;
  const decisionLogs = deps && deps.decisionLogsRepo ? deps.decisionLogsRepo : decisionLogsRepo;

  const [userStateSummary, memberSummary] = await Promise.all([
    userSummaryFn({ lineUserId }),
    memberSummaryFn({ lineUserId })
  ]);

  const readiness = userStateSummary && userStateSummary.overallDecisionReadiness
    ? userStateSummary.overallDecisionReadiness
    : buildReadiness(userStateSummary, readinessFn);

  const latestDecisionLog = await decisionLogs.getLatestDecision('user', lineUserId);
  const opsState = userStateSummary ? userStateSummary.opsState : null;

  return {
    ok: true,
    serverTime: new Date().toISOString(),
    lineUserId,
    userStateSummary,
    memberSummary,
    readiness,
    opsState,
    latestDecisionLog
  };
}

module.exports = {
  getOpsConsole
};
