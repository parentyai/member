'use strict';

const { buildObservationBlockerRows } = require('./buildObservationBlockerRows');

function serializePatrolObservationBlockers(params) {
  return buildObservationBlockerRows(params);
}

module.exports = {
  serializePatrolObservationBlockers
};
