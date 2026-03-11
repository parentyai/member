'use strict';

const assert = require('assert');
const { test } = require('node:test');

const {
  REQUIRED_HEADERS,
  parseCsvLine,
  parseCsvText,
  adaptSingleSheetCityPackTemplate
} = require('../../src/usecases/cityPack/singleSheetCityPackImportAdapter');

test('phase797: single-sheet adapter exposes required header contract', () => {
  assert.ok(Array.isArray(REQUIRED_HEADERS));
  assert.ok(REQUIRED_HEADERS.includes('row_type'));
  assert.ok(REQUIRED_HEADERS.includes('canonical_key'));
  assert.ok(REQUIRED_HEADERS.includes('source_ids_json'));
  assert.ok(REQUIRED_HEADERS.includes('city_pack_module_key'));
});

test('phase797: parseCsvLine supports quoted commas', () => {
  const line = 'VIEW,cp::ny::housing,"Housing, setup","[\\"sr_1\\",\\"sr_2\\"]",housing';
  const parsed = parseCsvLine(line);
  assert.strictEqual(parsed.length, 5);
  assert.strictEqual(parsed[1], 'cp::ny::housing');
  assert.strictEqual(parsed[2], 'Housing, setup');
});

test('phase797: parseCsvText maps headers to rows', () => {
  const csv = [
    'row_id,row_type,canonical_key,status,source_ids_json,city_pack_module_key,view_type,title_short,summary_md',
    'r1,VIEW,cp::ny::housing,active,"[\\"sr_1\\",\\"sr_2\\"]",housing,city_pack,Housing setup,desc',
    'r2,TASK,task::open_bank,active,"[]",housing,,,'
  ].join('\n');
  const parsed = parseCsvText(csv);
  assert.strictEqual(parsed.headers[0], 'row_id');
  assert.strictEqual(parsed.rows.length, 2);
  assert.strictEqual(parsed.rows[0].canonical_key, 'cp::ny::housing');
  assert.strictEqual(parsed.rows[1].row_type, 'TASK');
});

test('phase797: adapter builds city-pack template from single-sheet rows', () => {
  const adapted = adaptSingleSheetCityPackTemplate({
    templateName: 'NY City Pack',
    singleSheet: {
      headers: [
        'row_id', 'row_type', 'canonical_key', 'status', 'source_ids_json', 'city_pack_module_key', 'view_type', 'title_short', 'summary_md'
      ],
      rows: [
        {
          row_id: 'r1',
          row_type: 'VIEW',
          canonical_key: 'cp::ny::housing',
          status: 'active',
          source_ids_json: '["sr_1","sr_2"]',
          city_pack_module_key: 'housing',
          view_type: 'city_pack',
          title_short: 'NY Housing',
          summary_md: 'housing summary'
        },
        {
          row_id: 'r2',
          row_type: 'VIEW',
          canonical_key: 'cp::ny::driving',
          status: 'active',
          source_ids_json: '["sr_2","sr_3"]',
          city_pack_module_key: 'driving',
          view_type: 'city_pack',
          title_short: 'NY Driving',
          summary_md: 'driving summary'
        },
        {
          row_id: 'r3',
          row_type: 'TASK',
          canonical_key: 'task::open_bank',
          status: 'active',
          source_ids_json: '[]',
          city_pack_module_key: 'housing'
        }
      ]
    }
  });

  const template = adapted.template;
  assert.strictEqual(template.name, 'NY City Pack');
  assert.deepStrictEqual(template.modules, ['housing', 'driving']);
  assert.deepStrictEqual(template.sourceRefs, ['sr_1', 'sr_2', 'sr_3']);
  assert.strictEqual(template.recommendedTasks.length, 1);
  assert.strictEqual(template.recommendedTasks[0].ruleId, 'task::open_bank');
  assert.strictEqual(template.recommendedTasks[0].module, 'housing');
  assert.strictEqual(template.metadata.importSource, 'single_sheet_v1');
});

test('phase797: adapter rejects single-sheet payload when required headers are missing', () => {
  assert.throws(() => adaptSingleSheetCityPackTemplate({
    singleSheet: {
      headers: ['row_id', 'status'],
      rows: [{ row_id: 'x', status: 'active' }]
    }
  }), /singleSheet headers missing/);
});
