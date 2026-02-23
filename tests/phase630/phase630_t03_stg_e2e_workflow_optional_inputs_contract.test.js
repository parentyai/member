'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase630: stg e2e workflow makes segment/composer inputs optional with auto-detect description', () => {
  const text = fs.readFileSync(
    path.join(process.cwd(), '.github/workflows/stg-notification-e2e.yml'),
    'utf8'
  );

  assert.ok(text.includes('segment_template_key:'));
  assert.ok(text.includes('description: "Active template key for segment scenario (empty = auto-detect active)"'));
  assert.ok(text.includes('required: false'));
  assert.ok(text.includes('default: ""'));
  assert.ok(text.includes('composer_notification_id:'));
  assert.ok(
    text.includes(
      'description: "Active notificationId for composer cap scenario (empty = auto-detect plannable active)"'
    )
  );
});
