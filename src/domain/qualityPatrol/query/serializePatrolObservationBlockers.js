'use strict';

const { buildObservationBlockerRows } = require('./buildObservationBlockerRows');
const { resolveAudienceView } = require('./resolveAudienceView');
const {
  sanitizeHumanObservationBlockers
} = require('./buildHumanSafePatrolSurface');

function serializePatrolObservationBlockers(params) {
  const audience = resolveAudienceView(params && params.audience);
  const rows = buildObservationBlockerRows(params);
  if (audience !== 'human') return rows;
  return sanitizeHumanObservationBlockers(rows);
}

module.exports = {
  serializePatrolObservationBlockers
};
