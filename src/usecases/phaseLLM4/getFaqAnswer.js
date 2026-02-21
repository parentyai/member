// LEGACY_FROZEN_DO_NOT_USE
// reason: unreachable from current src/index.js route graph baseline (REPO_FULL_AUDIT_REPORT_2026-02-21).
// ssot_ref: docs/REPO_FULL_AUDIT_REPORT_2026-02-21.md
'use strict';

const { answerFaqFromKb } = require('../faq/answerFaqFromKb');

async function getFaqAnswer(params, deps) {
  return answerFaqFromKb(params, deps);
}

module.exports = {
  getFaqAnswer
};
