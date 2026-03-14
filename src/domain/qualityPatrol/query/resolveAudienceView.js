'use strict';

function resolveAudienceView(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized === 'human' ? 'human' : 'operator';
}

module.exports = {
  resolveAudienceView
};
