'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase578: AGENTS execution OS includes required baseline and enforcement sections', () => {
  const file = path.join(process.cwd(), 'AGENTS.md');
  const src = fs.readFileSync(file, 'utf8');

  assert.ok(src.includes('## 第1部：既存規範（原文保持）'));
  assert.ok(src.includes('## 第2部：強化規範（add-only追記）'));

  const requiredKeywords = [
    '観測義務',
    '副作用監査',
    '優先度妥当性',
    '反証義務',
    '認知負債',
    'ドキュメント整合義務',
    '次の一手',
    '曖昧語禁止',
    'ロールバック'
  ];
  for (const keyword of requiredKeywords) {
    assert.ok(src.includes(keyword), `missing keyword: ${keyword}`);
  }
});

test('phase578: docs verifier enforces AGENTS execution OS contract', () => {
  const file = path.join(process.cwd(), 'tools/verify_docs.js');
  const src = fs.readFileSync(file, 'utf8');

  assert.ok(src.includes("const AGENTS_PATH = path.join(ROOT, 'AGENTS.md');"));
  assert.ok(src.includes('AGENTS.md must exist and include mandatory execution guardrails'));
  assert.ok(src.includes('AGENTS.md に必須見出しがありません'));
  assert.ok(src.includes('AGENTS.md に必須キーワードがありません'));
});
