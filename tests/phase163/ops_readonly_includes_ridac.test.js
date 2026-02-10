'use strict';

const assert = require('assert');
const { test } = require('node:test');
const fs = require('fs');
const path = require('path');

test('ops readonly ui includes ridac status display', () => {
  const filePath = path.resolve(__dirname, '..', '..', 'apps', 'admin', 'ops_readonly.html');
  const html = fs.readFileSync(filePath, 'utf8');
  assert.ok(html.includes('ops-console-detail-ridac-status'));
  assert.ok(html.toLowerCase().includes('ridac'));
});

