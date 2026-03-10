'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

function createFakeDbStore() {
  const docs = new Map();
  return {
    docs,
    db: {
      collection: (collectionName) => ({
        doc: (id) => {
          const docId = id || `${collectionName}_${docs.size + 1}`;
          const key = `${collectionName}/${docId}`;
          return {
            id: docId,
            async set(payload, options) {
              const current = docs.get(key) || {};
              if (options && options.merge) {
                docs.set(key, Object.assign({}, current, payload));
                return;
              }
              docs.set(key, Object.assign({}, payload));
            },
            async get() {
              const row = docs.get(key);
              return {
                id: docId,
                exists: Boolean(row),
                data: () => row
              };
            }
          };
        }
      })
    }
  };
}

test('phase788: memory repos append recordEnvelope on writes', async () => {
  const infraPath = require.resolve('../../src/infra/firestore');
  const taskRepoPath = require.resolve('../../src/v1/memory_fabric/taskMemoryRepo');
  const sessionRepoPath = require.resolve('../../src/v1/memory_fabric/sessionMemoryRepo');
  const profileRepoPath = require.resolve('../../src/v1/memory_fabric/profileMemoryRepo');
  const complianceRepoPath = require.resolve('../../src/v1/memory_fabric/complianceMemoryRepo');
  const savedInfra = require.cache[infraPath];
  const savedTask = require.cache[taskRepoPath];
  const savedSession = require.cache[sessionRepoPath];
  const savedProfile = require.cache[profileRepoPath];
  const savedCompliance = require.cache[complianceRepoPath];
  const fake = createFakeDbStore();

  try {
    require.cache[infraPath] = {
      id: infraPath,
      filename: infraPath,
      loaded: true,
      exports: {
        getDb: () => fake.db,
        serverTimestamp: () => 'SERVER_TS'
      }
    };
    delete require.cache[taskRepoPath];
    delete require.cache[sessionRepoPath];
    delete require.cache[profileRepoPath];
    delete require.cache[complianceRepoPath];
    const taskRepo = require(taskRepoPath);
    const sessionRepo = require(sessionRepoPath);
    const profileRepo = require(profileRepoPath);
    const complianceRepo = require(complianceRepoPath);

    await taskRepo.putTaskMemory('U_PHASE788', { step: 'task' });
    await sessionRepo.putSessionMemory('U_PHASE788', { step: 'session' });
    await profileRepo.putProfileMemory('U_PHASE788', { step: 'profile' });
    await complianceRepo.putComplianceMemory('U_PHASE788', { step: 'compliance' });

    const taskRow = fake.docs.get('memory_task/U_PHASE788');
    const sessionRow = fake.docs.get('memory_session/U_PHASE788');
    const profileRow = fake.docs.get('memory_profile/U_PHASE788');
    const complianceRow = fake.docs.get('memory_compliance/U_PHASE788');

    assert.ok(taskRow.recordEnvelope && typeof taskRow.recordEnvelope === 'object');
    assert.equal(taskRow.recordEnvelope.record_type, 'memory_task');
    assert.ok(sessionRow.recordEnvelope && typeof sessionRow.recordEnvelope === 'object');
    assert.equal(sessionRow.recordEnvelope.record_type, 'memory_session');
    assert.ok(profileRow.recordEnvelope && typeof profileRow.recordEnvelope === 'object');
    assert.equal(profileRow.recordEnvelope.record_type, 'memory_profile');
    assert.ok(complianceRow.recordEnvelope && typeof complianceRow.recordEnvelope === 'object');
    assert.equal(complianceRow.recordEnvelope.record_type, 'memory_compliance');
  } finally {
    if (savedInfra) require.cache[infraPath] = savedInfra;
    else delete require.cache[infraPath];
    if (savedTask) require.cache[taskRepoPath] = savedTask;
    else delete require.cache[taskRepoPath];
    if (savedSession) require.cache[sessionRepoPath] = savedSession;
    else delete require.cache[sessionRepoPath];
    if (savedProfile) require.cache[profileRepoPath] = savedProfile;
    else delete require.cache[profileRepoPath];
    if (savedCompliance) require.cache[complianceRepoPath] = savedCompliance;
    else delete require.cache[complianceRepoPath];
  }
});
