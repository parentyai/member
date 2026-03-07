'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { sanitizePaidMainReply, containsLegacyTemplateTerms } = require('../src/domain/llm/conversation/paidReplyGuard');

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  const out = {
    fixture: path.join(__dirname, 'llm_eval', 'paid_golden_set.json')
  };
  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (current === '--fixture' && args[index + 1]) {
      out.fixture = path.resolve(process.cwd(), args[index + 1]);
      index += 1;
    }
  }
  return out;
}

function readFixture(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function evaluateCase(testCase) {
  const row = testCase && typeof testCase === 'object' ? testCase : {};
  const replyText = typeof row.replyText === 'string' ? row.replyText : '';
  const maxActions = Number.isFinite(Number(row.maxActions)) ? Number(row.maxActions) : 3;
  const mustNotContain = Array.isArray(row.mustNotContain) ? row.mustNotContain : [];
  const expectFollowupQuestion = row.expectFollowupQuestion === true;
  const guard = sanitizePaidMainReply(replyText, { maxActions });
  const failures = [];

  if (containsLegacyTemplateTerms(replyText)) failures.push('legacy_template_detected');
  if (guard.actionCount > maxActions) failures.push('action_limit_exceeded');
  if (expectFollowupQuestion && guard.followupQuestionIncluded !== true) failures.push('missing_followup_question');
  mustNotContain.forEach((token) => {
    if (String(replyText).includes(token)) failures.push(`forbidden_token:${token}`);
  });

  return {
    id: row.id || 'case',
    ok: failures.length === 0,
    failures,
    metrics: {
      actionCount: guard.actionCount,
      followupQuestionIncluded: guard.followupQuestionIncluded === true,
      pitfallIncluded: guard.pitfallIncluded === true,
      legacyTemplateHit: guard.legacyTemplateHit === true
    }
  };
}

function main() {
  const options = parseArgs(process.argv);
  const rows = readFixture(options.fixture);
  const results = rows.map(evaluateCase);
  const failed = results.filter((row) => row.ok !== true);
  const output = {
    ok: failed.length === 0,
    sampleCount: results.length,
    passCount: results.length - failed.length,
    failCount: failed.length,
    results
  };
  const target = output.ok ? process.stdout : process.stderr;
  target.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exit(output.ok ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  readFixture,
  evaluateCase
};
