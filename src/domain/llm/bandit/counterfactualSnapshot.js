'use strict';

function normalizeNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeText(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function clampMaxArms(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 3;
  return Math.max(1, Math.min(5, Math.floor(num)));
}

function normalizeCandidate(value) {
  const payload = value && typeof value === 'object' ? value : {};
  return {
    armId: normalizeText(payload.armId, ''),
    styleId: normalizeText(payload.styleId, null),
    ctaCount: Math.max(0, Math.floor(normalizeNumber(payload.ctaCount, 0))),
    score: Number(normalizeNumber(payload.score, 0).toFixed(6))
  };
}

function buildCounterfactualSnapshot(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const selectedArmId = normalizeText(payload.selectedArmId, '');
  const candidates = (Array.isArray(payload.candidates) ? payload.candidates : [])
    .map((row) => normalizeCandidate(row))
    .filter((row) => row.armId);

  const sorted = candidates.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.armId.localeCompare(right.armId, 'ja');
  });

  const maxArms = clampMaxArms(payload.maxArms);
  const topArms = sorted.slice(0, maxArms).map((row, index) => ({
    rank: index + 1,
    armId: row.armId,
    styleId: row.styleId,
    ctaCount: row.ctaCount,
    score: row.score
  }));

  const selectedRank = selectedArmId
    ? (() => {
        const index = sorted.findIndex((row) => row.armId === selectedArmId);
        return index >= 0 ? index + 1 : null;
      })()
    : null;

  return {
    selectedArmId: selectedArmId || null,
    selectedRank,
    topArms
  };
}

module.exports = {
  buildCounterfactualSnapshot
};
