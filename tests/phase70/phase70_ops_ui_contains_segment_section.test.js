'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase70: ops_readonly includes segment send and retry queue sections', () => {
  const filePath = path.resolve(__dirname, '..', '..', 'apps', 'admin', 'ops_readonly.html');
  const html = fs.readFileSync(filePath, 'utf8');
  const requiredIds = [
    'segment-send-section',
    'segment-template-key',
    'segment-plan',
    'segment-execute',
    'segment-plan-result',
    'segment-execute-result',
    'retry-queue-section',
    'retry-queue-rows'
  ];
  requiredIds.forEach((id) => {
    assert.ok(html.includes(`id=\"${id}\"`), `missing id: ${id}`);
  });
});
