'use strict';

const crypto = require('node:crypto');
const { BACKLOG_TEMPLATE_BY_METRIC } = require('./constants');

function buildBacklogCandidate(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const template = BACKLOG_TEMPLATE_BY_METRIC[payload.metricKey] || BACKLOG_TEMPLATE_BY_METRIC[payload.parentMetricKey] || {
    title: 'Quality Patrol improvement',
    priority: 'P2',
    objective: 'Address a detected Quality Patrol issue.'
  };
  const title = payload.title || template.title;
  const priority = payload.priority || template.priority;
  const objective = payload.objective || template.objective;
  const seed = [title, priority, objective].join('|');

  return {
    backlogKey: `qpd_backlog_${crypto.createHash('sha256').update(seed, 'utf8').digest('hex').slice(0, 16)}`,
    title,
    priority,
    objective
  };
}

module.exports = {
  buildBacklogCandidate
};
