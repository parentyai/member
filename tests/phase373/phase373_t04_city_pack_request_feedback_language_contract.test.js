'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const cityPackRequestsRepo = require('../../src/repos/firestore/cityPackRequestsRepo');
const cityPackFeedbackRepo = require('../../src/repos/firestore/cityPackFeedbackRepo');

test('phase373: city_pack_requests and city_pack_feedback persist class/language fields', async () => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
  try {
    const requestCreated = await cityPackRequestsRepo.createRequest({
      lineUserId: 'line_phase373_req',
      regionKey: 'US::nationwide',
      traceId: 'trace_phase373_req',
      requestClass: 'nationwide',
      requestedLanguage: 'ja'
    });
    const requestRow = await cityPackRequestsRepo.getRequest(requestCreated.id);
    assert.strictEqual(requestRow.requestClass, 'nationwide');
    assert.strictEqual(requestRow.requestedLanguage, 'ja');

    const requests = await cityPackRequestsRepo.listRequests({
      requestClass: 'nationwide',
      requestedLanguage: 'ja',
      limit: 20
    });
    assert.ok(requests.some((item) => item.id === requestCreated.id));

    const feedbackCreated = await cityPackFeedbackRepo.createFeedback({
      lineUserId: 'line_phase373_fb',
      feedbackText: 'federal link outdated',
      traceId: 'trace_phase373_fb',
      packClass: 'nationwide',
      language: 'ja'
    });
    const feedbackRow = await cityPackFeedbackRepo.getFeedback(feedbackCreated.id);
    assert.strictEqual(feedbackRow.packClass, 'nationwide');
    assert.strictEqual(feedbackRow.language, 'ja');

    const feedbackRows = await cityPackFeedbackRepo.listFeedback({
      packClass: 'nationwide',
      language: 'ja',
      limit: 20
    });
    assert.ok(feedbackRows.some((item) => item.id === feedbackCreated.id));
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
