'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { tableCore, sortCore, filterCore } = require('../../apps/admin/assets/admin_ui_core.js');

test('phase635: table core renders columns and normalizes empty cells', () => {
  const view = tableCore.renderTable({
    rows: [{ title: '', sent: 12 }],
    columns: [{ key: 'title' }, { key: 'sent' }],
    emptyCellText: 'NOT AVAILABLE'
  });
  assert.equal(view.empty, false);
  assert.equal(view.rows.length, 1);
  assert.equal(view.rows[0].cells[0].text, 'NOT AVAILABLE');
  assert.equal(view.rows[0].cells[1].text, '12');
});

test('phase635: sort core supports string/date/number and keeps empty last', () => {
  const rows = [
    { id: 'c', label: '', createdAt: '2025-01-01T00:00:00.000Z', count: 8 },
    { id: 'b', label: 'Beta', createdAt: '2025-01-03T00:00:00.000Z', count: 2 },
    { id: 'a', label: 'Alpha', createdAt: '2025-01-02T00:00:00.000Z', count: 20 }
  ];

  const byLabelAsc = sortCore.sortRows(rows, { key: 'label', dir: 'asc', typeMap: { label: 'string' } });
  assert.deepEqual(byLabelAsc.map((row) => row.id), ['a', 'b', 'c']);

  const byDateDesc = sortCore.sortRows(rows, { key: 'createdAt', dir: 'desc', typeMap: { createdAt: 'date' } });
  assert.deepEqual(byDateDesc.map((row) => row.id), ['b', 'a', 'c']);

  const byNumberAsc = sortCore.sortRows(rows, { key: 'count', dir: 'asc', typeMap: { count: 'number' } });
  assert.deepEqual(byNumberAsc.map((row) => row.id), ['b', 'c', 'a']);
});

test('phase635: filter core applies AND descriptors with normalization', () => {
  const rows = [
    { id: 'n1', title: '  alpha world ', status: 'ACTIVE', type: 'STEP' },
    { id: 'n2', title: 'beta world', status: 'DRAFT', type: 'GENERAL' },
    { id: 'n3', title: 'alpha', status: 'ACTIVE', type: 'GENERAL' }
  ];
  const filtered = filterCore.applyAndFilters(rows, [
    { type: 'includes', value: ' ALPHA ', normalize: { trim: true, lower: true }, getValue: (row) => row.title },
    { type: 'equals', value: 'active', normalize: { trim: true, lower: true }, getValue: (row) => row.status },
    { type: 'equals', value: 'STEP', normalize: { trim: true, upper: true }, getValue: (row) => row.type }
  ]);
  assert.deepEqual(filtered.map((row) => row.id), ['n1']);
});
