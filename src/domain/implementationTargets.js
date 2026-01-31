'use strict';

const IMPLEMENTATION_TARGETS = Object.freeze([
  Object.freeze({
    id: 'CO1-D-001-A01',
    name: '設計対象一覧の詳細化',
    tag: 'design-scope-detail',
    status: 'IN'
  })
]);

function listImplementationTargets() {
  return IMPLEMENTATION_TARGETS.slice();
}

module.exports = {
  listImplementationTargets
};
