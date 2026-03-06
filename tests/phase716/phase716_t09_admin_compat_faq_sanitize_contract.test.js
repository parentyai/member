'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('phase716: admin/compat FAQ path applies shared sanitize and emits sanitize gate metadata', () => {
  const faqUsecase = read('src/usecases/faq/answerFaqFromKb.js');
  const adminFaqRoute = read('src/routes/admin/llmFaq.js');
  const compatFaqRoute = read('src/routes/phaseLLM4FaqAnswer.js');

  assert.ok(faqUsecase.includes('sanitizeRetrievalCandidates([rawCandidates])'));
  assert.ok(faqUsecase.includes('sanitizeApplied'));
  assert.ok(faqUsecase.includes('sanitizedCandidateCount'));
  assert.ok(faqUsecase.includes('sanitizeBlockedReasons'));
  assert.ok(faqUsecase.includes('injectionFindings'));

  assert.ok(adminFaqRoute.includes('sanitizeApplied: result && result.sanitizeApplied === true'));
  assert.ok(adminFaqRoute.includes('sanitizedCandidateCount: result && Number.isFinite(Number(result.sanitizedCandidateCount))'));
  assert.ok(adminFaqRoute.includes("gatesApplied: ['kill_switch', 'injection', 'url_guard']"));

  assert.ok(compatFaqRoute.includes('sanitizeApplied: result && result.sanitizeApplied === true'));
  assert.ok(compatFaqRoute.includes('sanitizedCandidateCount: result && Number.isFinite(Number(result.sanitizedCandidateCount))'));
  assert.ok(compatFaqRoute.includes("gatesApplied: ['kill_switch', 'injection', 'url_guard']"));
});
