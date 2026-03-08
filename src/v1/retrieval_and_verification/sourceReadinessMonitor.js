'use strict';

function computeSourceFreshnessScore(sourceRefs, nowIso) {
  const refs = Array.isArray(sourceRefs) ? sourceRefs : [];
  if (!refs.length) return 0;
  const now = nowIso ? new Date(nowIso).getTime() : Date.now();
  const scores = refs.map((row) => {
    const updatedAt = row && row.updatedAt ? new Date(row.updatedAt).getTime() : 0;
    if (!updatedAt || Number.isNaN(updatedAt)) return 0;
    const ageDays = Math.max(0, (now - updatedAt) / (24 * 60 * 60 * 1000));
    if (ageDays <= 14) return 1;
    if (ageDays <= 45) return 0.7;
    if (ageDays <= 90) return 0.4;
    return 0.1;
  });
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
}

module.exports = {
  computeSourceFreshnessScore
};
