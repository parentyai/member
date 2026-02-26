'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { toRows } = require('../../tools/import_nces_ccd_public_schools');

test('phase666: NCES import parser keeps public/unknown and rejects explicit private rows', () => {
  const csv = [
    'regionKey,name,district,sourceUrl,schoolType',
    'ny::new-york,Public One,NYC DOE,https://example.org/public,public',
    'ny::new-york,Private One,NYC DOE,https://example.org/private,private',
    'ny::new-york,Unknown Type,NYC DOE,https://example.org/unknown,'
  ].join('\n');
  const rows = toRows(csv, {});
  assert.strictEqual(rows.length, 2);
  assert.ok(rows.some((row) => row.name === 'Public One' && row.schoolType === 'public'));
  assert.ok(rows.some((row) => row.name === 'Unknown Type'));
  assert.ok(!rows.some((row) => row.name === 'Private One'));
});

