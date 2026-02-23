'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase630: runbook marks segment/composer inputs as optional with auto-resolve guidance', () => {
  const text = fs.readFileSync(
    path.join(process.cwd(), 'docs/RUNBOOK_STG_NOTIFICATION_E2E_CHECKLIST.md'),
    'utf8'
  );

  assert.ok(
    text.includes('segment-template-key')
      && text.includes('未指定時は `status=active` を自動解決')
  );
  assert.ok(
    text.includes('composer-notification-id')
      && text.includes('active 一覧から `send/plan` 可能な候補を自動解決')
  );
});
