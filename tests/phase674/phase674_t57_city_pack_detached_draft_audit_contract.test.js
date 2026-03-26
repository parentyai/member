'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  collectDetachedCityPackDrafts
} = require('../../tools/admin_bootstrap_city_emergency');

test('phase674: city pack bootstrap marks only unreferenced drafts as detached', () => {
  const detached = collectDetachedCityPackDrafts([
    {
      id: 'cp_active',
      status: 'active',
      requestId: 'req_active',
      name: 'Active pack',
      packClass: 'regional',
      language: 'ja'
    },
    {
      id: 'cp_draft_linked',
      status: 'draft',
      requestId: 'req_active',
      name: 'Linked draft',
      packClass: 'regional',
      language: 'ja'
    },
    {
      id: 'cp_draft_referenced_only',
      status: 'draft',
      requestId: null,
      name: 'Referenced draft',
      packClass: 'regional',
      language: 'ja'
    },
    {
      id: 'cp_draft_detached',
      status: 'draft',
      requestId: null,
      name: 'Detached draft',
      packClass: 'regional',
      language: 'ja'
    }
  ], [
    {
      id: 'req_active',
      status: 'active',
      draftCityPackIds: ['cp_active', 'cp_draft_referenced_only']
    }
  ]);

  assert.deepEqual(detached, [{
    id: 'cp_draft_detached',
    name: 'Detached draft',
    requestId: null,
    packClass: 'regional',
    language: 'ja',
    status: 'draft'
  }]);
});
