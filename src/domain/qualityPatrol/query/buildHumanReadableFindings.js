'use strict';

const { resolveAudienceView } = require('./resolveAudienceView');

function buildHumanReadableFindings(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const audience = resolveAudienceView(payload.audience);
  const findings = [];
  const blockers = Array.isArray(payload.observationBlockers) ? payload.observationBlockers : [];
  const issues = Array.isArray(payload.issues) ? payload.issues : [];
  const recommendedPr = Array.isArray(payload.recommendedPr) ? payload.recommendedPr : [];
  const planningStatus = typeof payload.planningStatus === 'string' ? payload.planningStatus : 'unavailable';
  const mode = typeof payload.mode === 'string' ? payload.mode : 'latest';
  const hasActiveSurface = blockers.length > 0 || issues.length > 0 || recommendedPr.length > 0;

  if (planningStatus === 'insufficient_evidence' && hasActiveSurface === false) {
    findings.push(audience === 'human'
      ? '直近の自然な会話証跡がまだ足りないため、改善提案は保留です。'
      : 'organic current runtime evidence is unavailable; waiting for fresh reviewable traffic before proposing changes.');
  }

  if (blockers.length > 0) {
    findings.push(audience === 'human'
      ? '観測不足が残っているため、改善提案より先に証跡の回収を優先します。'
      : `blocker-first: ${blockers.length} observation blockers are still preventing confident conclusions.`);
  }

  if (mode === 'newly-detected-improvements') {
    const newIssues = issues.filter((item) => item.changeStatus === 'new').length;
    const newPr = recommendedPr.filter((item) => item.changeStatus === 'new').length;
    findings.push(audience === 'human'
      ? `新しく検知された改善候補は ${newPr} 件、関連する新規 issue は ${newIssues} 件です。`
      : `newly-detected: proposals=${newPr} issues=${newIssues}`);
  }

  if (audience === 'human' && blockers[0]) {
    findings.push(blockers[0].summary);
  } else if (issues[0]) {
    findings.push(audience === 'human'
      ? `${issues[0].title}。${issues[0].summary}`
      : `${issues[0].title} [${issues[0].severity}/${issues[0].status}] ${issues[0].summary}`);
  }

  if (recommendedPr[0]) {
    findings.push(audience === 'human'
      ? (blockers[0]
        ? `次に優先するのは、${blockers[0].recommendedAction}`
        : `次に見る候補は「${recommendedPr[0].title}」です。${recommendedPr[0].objective}`)
      : `next proposal=${recommendedPr[0].title} priority=${recommendedPr[0].priority} risk=${recommendedPr[0].riskLevel}`);
  }

  return findings.slice(0, 3);
}

module.exports = {
  buildHumanReadableFindings
};
