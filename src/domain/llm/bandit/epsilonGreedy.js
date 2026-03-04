'use strict';

const DEFAULT_EPSILON = 0.1;

function clampEpsilon(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_EPSILON;
  if (num <= 0) return 0;
  if (num >= 1) return 1;
  return Number(num.toFixed(6));
}

function normalizeStateByArm(value) {
  const src = value && typeof value === 'object' ? value : {};
  const out = Object.create(null);
  Object.keys(src).forEach((key) => {
    const item = src[key] && typeof src[key] === 'object' ? src[key] : {};
    const pulls = Number(item.pulls);
    const avgReward = Number(item.avgReward);
    out[key] = {
      pulls: Number.isFinite(pulls) && pulls > 0 ? Math.floor(pulls) : 0,
      avgReward: Number.isFinite(avgReward) ? avgReward : 0
    };
  });
  return out;
}

function chooseRandom(candidates, randomFn) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const random = typeof randomFn === 'function' ? randomFn : Math.random;
  const index = Math.floor(Math.max(0, Math.min(0.999999, Number(random()))) * candidates.length);
  return candidates[index] || candidates[0];
}

function chooseExploit(candidates, stateByArm) {
  const rows = Array.isArray(candidates) ? candidates : [];
  if (!rows.length) return null;
  const state = normalizeStateByArm(stateByArm);
  const sorted = rows.slice().sort((left, right) => {
    const leftState = state[left.armId] || { pulls: 0, avgReward: 0 };
    const rightState = state[right.armId] || { pulls: 0, avgReward: 0 };
    const leftEstimate = leftState.pulls > 0 ? leftState.avgReward : Number(left.score || 0);
    const rightEstimate = rightState.pulls > 0 ? rightState.avgReward : Number(right.score || 0);
    if (rightEstimate !== leftEstimate) return rightEstimate - leftEstimate;
    const leftPulls = leftState.pulls;
    const rightPulls = rightState.pulls;
    if (rightPulls !== leftPulls) return rightPulls - leftPulls;
    const leftScore = Number(left.score || 0);
    const rightScore = Number(right.score || 0);
    if (rightScore !== leftScore) return rightScore - leftScore;
    return String(left.armId || '').localeCompare(String(right.armId || ''), 'ja');
  });
  return sorted[0] || rows[0];
}

function chooseArm(candidates, options) {
  const rows = Array.isArray(candidates) ? candidates : [];
  if (!rows.length) {
    return {
      selected: null,
      selectionSource: 'score',
      epsilon: clampEpsilon(options && options.epsilon)
    };
  }

  const payload = options && typeof options === 'object' ? options : {};
  const epsilon = clampEpsilon(payload.epsilon);
  const random = typeof payload.randomFn === 'function' ? payload.randomFn : Math.random;

  const roll = Number(random());
  if (Number.isFinite(roll) && roll < epsilon) {
    return {
      selected: chooseRandom(rows, payload.randomFn),
      selectionSource: 'bandit_explore',
      epsilon
    };
  }

  return {
    selected: chooseExploit(rows, payload.stateByArm || {}),
    selectionSource: 'bandit_exploit',
    epsilon
  };
}

module.exports = {
  DEFAULT_EPSILON,
  clampEpsilon,
  chooseArm
};
