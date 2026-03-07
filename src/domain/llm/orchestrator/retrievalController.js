'use strict';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function judgeNeedRetrieval(packet, strategyPlan) {
  const strategy = normalizeText(strategyPlan && strategyPlan.strategy).toLowerCase();
  if (!strategy || strategy === 'casual' || strategy === 'clarify' || strategy === 'domain_concierge' || strategy === 'concierge') {
    return false;
  }
  if (strategy === 'recommendation') return true;
  const messageText = normalizeText(packet && packet.messageText);
  if (messageText.length <= 10) return false;
  return true;
}

function judgeRetrievalQuality(result) {
  const payload = result && typeof result === 'object' ? result : {};
  if (payload.ok !== true) return 'bad';
  const quality = payload.assistantQuality && typeof payload.assistantQuality === 'object' ? payload.assistantQuality : {};
  const top1Score = Number.isFinite(Number(payload.top1Score)) ? Number(payload.top1Score) : Number(quality.kbTopScore || 0);
  const evidenceCoverage = Number.isFinite(Number(quality.evidenceCoverage)) ? Number(quality.evidenceCoverage) : 0;
  if (top1Score >= 0.8 && evidenceCoverage >= 0.8) return 'good';
  if (top1Score >= 0.45 && evidenceCoverage >= 0.5) return 'mixed';
  return 'bad';
}

function judgeEvidenceSufficiency(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const strategy = normalizeText(payload.strategy).toLowerCase();
  const retrievalNeeded = payload.retrieveNeeded === true;
  const retrievalQuality = normalizeText(payload.retrievalQuality).toLowerCase();
  const blockedReason = normalizeText(payload.blockedReason).toLowerCase();

  if (!retrievalNeeded) return 'answer';
  if (retrievalQuality === 'good') return 'answer';
  if (retrievalQuality === 'mixed') return strategy === 'recommendation' ? 'answer_with_hedge' : 'clarify';
  if (blockedReason === 'forbidden_domain') return 'refuse';
  return 'clarify';
}

module.exports = {
  judgeNeedRetrieval,
  judgeRetrievalQuality,
  judgeEvidenceSufficiency
};
