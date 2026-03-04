'use strict';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeArms(value) {
  const rows = Array.isArray(value) ? value : [];
  return rows
    .slice(0, 5)
    .map((item, index) => {
      const row = item && typeof item === 'object' ? item : {};
      return {
        rank: Number.isFinite(Number(row.rank)) ? Math.max(1, Math.floor(Number(row.rank))) : index + 1,
        armId: normalizeText(row.armId) || null,
        styleId: normalizeText(row.styleId) || null,
        ctaCount: Math.max(0, Math.floor(normalizeNumber(row.ctaCount, 0))),
        score: normalizeNumber(row.score, 0)
      };
    })
    .filter((row) => row.armId);
}

function findSelectedArm(arms, selectedArmId) {
  const normalizedArmId = normalizeText(selectedArmId);
  if (!normalizedArmId) return null;
  return arms.find((row) => row.armId === normalizedArmId) || null;
}

function evaluateCounterfactualChoice(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const selectedArmId = normalizeText(payload.selectedArmId) || null;
  const selectedRank = Number.isFinite(Number(payload.selectedRank))
    ? Math.max(1, Math.floor(Number(payload.selectedRank)))
    : null;
  const minGap = Math.max(0, normalizeNumber(payload.minGap, 0.12));
  const topArms = normalizeArms(payload.topArms);

  const best = topArms[0] || null;
  const selectedArm = findSelectedArm(topArms, selectedArmId);
  const selectedScore = selectedArm
    ? selectedArm.score
    : normalizeNumber(payload.selectedScore, 0);
  const bestScore = best ? best.score : normalizeNumber(payload.bestScore, selectedScore);
  const scoreGap = Number(Math.max(0, bestScore - selectedScore).toFixed(6));

  const selectedArmResolved = selectedArmId || (selectedArm && selectedArm.armId) || null;
  const selectedRankResolved = selectedRank || (selectedArm && selectedArm.rank) || null;

  const eligible = Boolean(selectedArmResolved && best && topArms.length >= 2);
  const opportunityDetected = Boolean(
    eligible
    && selectedRankResolved
    && selectedRankResolved > 1
    && scoreGap >= minGap
  );

  return {
    version: 'v1',
    eligible,
    selectedArmId: selectedArmResolved,
    selectedRank: selectedRankResolved,
    bestArmId: best ? best.armId : null,
    bestScore: Number(bestScore.toFixed(6)),
    selectedScore: Number(selectedScore.toFixed(6)),
    scoreGap,
    minGap,
    opportunityDetected
  };
}

module.exports = {
  evaluateCounterfactualChoice
};
