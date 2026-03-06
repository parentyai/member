'use strict';

const { STYLES } = require('./responseStyles');
const { chooseArm, DEFAULT_EPSILON } = require('../bandit/epsilonGreedy');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function clampInt(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const floored = Math.floor(num);
  if (floored < min) return min;
  if (floored > max) return max;
  return floored;
}

function resolveLengthBucket(messageLength) {
  const size = Number(messageLength);
  if (!Number.isFinite(size) || size <= 0) return 'short';
  if (size >= 80) return 'long';
  if (size >= 25) return 'medium';
  return 'short';
}

function resolveTimingBucket(timeOfDay) {
  const hour = clampInt(timeOfDay, 0, 23, 12);
  if (hour < 6) return 'night';
  if (hour < 11) return 'morning';
  if (hour < 18) return 'daytime';
  return 'evening';
}

function resolveStyleCandidates(styleId, mode, topic) {
  const base = normalizeText(styleId) || STYLES.COACH;
  const modeNormalized = normalizeText(mode).toUpperCase();
  const topicNormalized = normalizeText(topic).toLowerCase();
  const out = [base];

  if (modeNormalized === 'B') out.push(STYLES.CHECKLIST);
  if (modeNormalized === 'C') out.push(STYLES.WEEKEND);
  if (topicNormalized === 'other') out.push(STYLES.DEBUG);
  if (!out.includes(STYLES.COACH)) out.push(STYLES.COACH);

  return Array.from(new Set(out)).slice(0, 3);
}

function buildScoreBreakdown(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const penalties = Number(payload.confidencePenalty || 0) + Number(payload.evidencePenalty || 0) + Number(payload.behaviorPenalty || 0);
  const wStyle = Number(payload.primaryStyleMatch ? 0.25 : 0) + Number(payload.modeFit || 0);
  const wTiming = Number(payload.timingFit || 0);
  const wCta = Number(payload.ctaFit || 0) + Number(payload.clarifyBonus || 0);
  const terms = {
    base: 0.5,
    primaryStyle: payload.primaryStyleMatch ? 0.25 : 0,
    modeFit: payload.modeFit,
    ctaFit: payload.ctaFit,
    confidencePenalty: payload.confidencePenalty,
    evidencePenalty: payload.evidencePenalty,
    clarifyBonus: payload.clarifyBonus,
    wStyle: Number(wStyle.toFixed(6)),
    wTiming: Number(wTiming.toFixed(6)),
    wCta: Number(wCta.toFixed(6)),
    penalties: Number(penalties.toFixed(6))
  };
  const score = Number(terms.base || 0) + wStyle + wTiming + wCta + penalties;
  return {
    score: Number(score.toFixed(6)),
    scoreBreakdown: terms
  };
}

function buildDeterministicCandidates(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const styleDecision = payload.styleDecision && typeof payload.styleDecision === 'object' ? payload.styleDecision : {};
  const confidence = payload.confidence && typeof payload.confidence === 'object' ? payload.confidence : {};
  const mode = normalizeText(payload.mode).toUpperCase() || 'A';
  const topic = normalizeText(payload.topic).toLowerCase() || 'general';
  const userTier = normalizeText(payload.userTier).toLowerCase() || 'free';
  const maxActions = clampInt(styleDecision.maxActions, 1, 3, userTier === 'free' ? 2 : 3);
  const askClarifying = payload.forceClarify === true || styleDecision.askClarifying === true;
  const styleCandidates = resolveStyleCandidates(styleDecision.styleId, mode, topic);
  const ctaCounts = Array.from({ length: maxActions }, (_v, index) => index + 1);

  const lengthBucket = resolveLengthBucket(payload.messageLength);
  const timingBucket = resolveTimingBucket(payload.timeOfDay);

  const candidates = [];
  styleCandidates.forEach((styleId) => {
    ctaCounts.forEach((ctaCount) => {
      const modeFit = mode === 'B' && styleId === STYLES.CHECKLIST
        ? 0.22
        : (mode === 'C' && styleId === STYLES.WEEKEND
          ? 0.22
          : (mode === 'A' && styleId === STYLES.COACH ? 0.14 : 0));
      const preferredCta = userTier === 'free' ? Math.min(2, maxActions) : Math.min(3, maxActions);
      const ctaFit = ctaCount === preferredCta ? 0.13 : (ctaCount < preferredCta ? 0.08 : -0.02);
      const intentConfidence = Number.isFinite(Number(confidence.intentConfidence)) ? Number(confidence.intentConfidence) : 0.5;
      const contextConfidence = Number.isFinite(Number(confidence.contextConfidence)) ? Number(confidence.contextConfidence) : 0.5;
      const confidencePenalty = (intentConfidence < 0.6 || contextConfidence < 0.55) && ctaCount > 1 ? -0.18 : 0;
      const evidencePenalty = normalizeText(payload.evidenceNeed) === 'required' && ctaCount > 2 ? -0.08 : 0;
      const clarifyBonus = askClarifying && ctaCount <= 2 ? 0.08 : 0;
      const timingFit = timingBucket === 'night'
        ? (ctaCount <= 2 ? 0.01 : -0.03)
        : (timingBucket === 'morning' ? 0.03 : 0.02);
      const behaviorPenalty = askClarifying && ctaCount > 2 ? -0.04 : 0;

      const scored = buildScoreBreakdown({
        primaryStyleMatch: styleId === styleDecision.styleId,
        modeFit,
        ctaFit,
        confidencePenalty,
        evidencePenalty,
        clarifyBonus,
        timingFit,
        behaviorPenalty
      });

      candidates.push({
        armId: `${styleId}|cta=${ctaCount}`,
        styleId,
        ctaCount,
        questionFlag: askClarifying,
        lengthBucket,
        timingBucket,
        score: scored.score,
        scoreBreakdown: scored.scoreBreakdown,
        optimizationVersion: 'v2'
      });
    });
  });

  return candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.armId).localeCompare(String(b.armId), 'ja');
  });
}

function buildSegmentKey(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const journeyPhase = normalizeText(payload.journeyPhase || 'pre').toLowerCase() || 'pre';
  const tier = normalizeText(payload.userTier || 'free').toLowerCase() || 'free';
  const riskBucket = normalizeText(payload.riskBucket || 'low').toLowerCase() || 'low';
  return `${journeyPhase}|${tier}|${riskBucket}`;
}

function selectActionForConversation(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const candidates = buildDeterministicCandidates(payload);
  const fallback = candidates[0] || {
    armId: `${STYLES.COACH}|cta=1`,
    styleId: STYLES.COACH,
    ctaCount: 1,
    questionFlag: true,
    lengthBucket: 'short',
    timingBucket: 'daytime',
    score: 0,
    scoreBreakdown: { base: 0, wStyle: 0, wTiming: 0, wCta: 0, penalties: 0 },
    optimizationVersion: 'v2'
  };

  const bandit = payload.bandit && typeof payload.bandit === 'object' ? payload.bandit : {};
  const banditEnabled = bandit.enabled === true;
  const epsilon = Number.isFinite(Number(bandit.epsilon)) ? Number(bandit.epsilon) : DEFAULT_EPSILON;
  const contextualStateByArm = bandit.contextualStateByArm && typeof bandit.contextualStateByArm === 'object'
    ? bandit.contextualStateByArm
    : {};
  const hasContextualBanditState = Object.keys(contextualStateByArm).length > 0;

  if (!banditEnabled) {
    return {
      selected: fallback,
      candidates,
      selectionSource: 'score',
      epsilon,
      segmentKey: buildSegmentKey(payload),
      contextualBanditUsed: false
    };
  }

  const banditStateByArm = hasContextualBanditState
    ? contextualStateByArm
    : (bandit.stateByArm || {});

  const picked = chooseArm(candidates, {
    epsilon,
    stateByArm: banditStateByArm,
    randomFn: bandit.randomFn
  });

  const rawSelectionSource = picked.selectionSource || 'score';
  const selectionSource = hasContextualBanditState
    ? (rawSelectionSource === 'bandit_explore' ? 'bandit_contextual_explore' : (rawSelectionSource === 'bandit_exploit' ? 'bandit_contextual_exploit' : rawSelectionSource))
    : rawSelectionSource;

  return {
    selected: picked.selected || fallback,
    candidates,
    selectionSource,
    epsilon,
    segmentKey: buildSegmentKey(payload),
    contextualBanditUsed: hasContextualBanditState
  };
}

module.exports = {
  resolveLengthBucket,
  resolveTimingBucket,
  buildSegmentKey,
  buildDeterministicCandidates,
  selectActionForConversation
};
