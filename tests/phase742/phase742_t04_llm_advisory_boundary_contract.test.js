'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

function read(relPath) {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8');
}

test('phase742: canonical task/journey path stays independent from phaseLLM3 advisory route', () => {
  const taskEngine = read('src/usecases/tasks/computeNextTasks.js');
  const journeyCommand = read('src/usecases/journey/handleJourneyLineCommand.js');
  const webhookLine = read('src/routes/webhookLine.js');
  const adminLlmRoute = read('src/routes/admin/llmOps.js');

  assert.ok(taskEngine.includes('computeDailyTopTasks'));
  assert.ok(journeyCommand.includes('computeNextTasks'));

  assert.equal(taskEngine.includes('phaseLLM3'), false);
  assert.equal(taskEngine.includes('getNextActionCandidates'), false);
  assert.equal(journeyCommand.includes('phaseLLM3'), false);
  assert.equal(webhookLine.includes('getNextActionCandidates'), false);

  assert.ok(adminLlmRoute.includes('getNextActionCandidates'));
  assert.ok(adminLlmRoute.includes('requireActor'));
});
