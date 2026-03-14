'use strict';

const KPI_SLICES = Object.freeze(['broad', 'housing', 'city', 'follow-up', 'other']);

const KPI_PROVENANCE = 'review_unit_evaluator';

const KPI_THRESHOLDS = Object.freeze({
  signal: { direction: 'higher', passMin: 0.8, warnMin: 0.6 },
  availability: { direction: 'higher', passMin: 0.85, warnMin: 0.65 },
  issueRate: { direction: 'lower', passMax: 0.12, warnMax: 0.3 },
  blockerRate: { direction: 'lower', passMax: 0.08, warnMax: 0.2 },
  repetitionRisk: { direction: 'lower', passMax: 0.25, warnMax: 0.45 }
});

module.exports = {
  KPI_SLICES,
  KPI_PROVENANCE,
  KPI_THRESHOLDS
};
