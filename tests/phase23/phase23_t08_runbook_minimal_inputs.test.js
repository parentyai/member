import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const runbook = readFileSync('docs/archive/phases/PHASE23_RUNBOOK.md', 'utf8');

function parseTables(contents) {
  const lines = contents.split(/\r?\n/).map((line) => line.trim());
  const tables = [];
  let current = [];
  for (const line of lines) {
    if (line.startsWith('|')) {
      current.push(line);
    } else if (current.length) {
      tables.push(current);
      current = [];
    }
  }
  if (current.length) tables.push(current);
  return tables;
}

function parseHeader(tableLines) {
  const header = tableLines[0];
  return header.split('|').slice(1, -1).map((cell) => cell.trim());
}

function parseRows(tableLines, columns) {
  const rows = [];
  for (const line of tableLines.slice(1)) {
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.every((cell) => /^-+$/.test(cell))) continue;
    const row = {};
    columns.forEach((col, idx) => {
      row[col] = cells[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
}

test('phase23 t08: decision table uses minimal routing inputs', () => {
  const tables = parseTables(runbook);
  const decision = tables.find((table) => {
    const cols = parseHeader(table);
    return cols.includes('result') && cols.includes('failure_class') && cols.includes('nextAction');
  });
  assert.ok(decision, 'decision table not found');
  const header = parseHeader(decision);
  assert.deepEqual(header, ['result', 'failure_class', 'nextAction']);
});

test('phase23 t08: required observation keys match decision inputs', () => {
  const tables = parseTables(runbook);
  const observation = tables.find((table) => {
    const cols = parseHeader(table);
    return cols[0] === 'key' && cols[1] === 'required' && cols[2] === 'notes';
  });
  assert.ok(observation, 'observation keys table not found');
  const obsHeader = parseHeader(observation);
  const obsRows = parseRows(observation, obsHeader);
  const requiredKeys = obsRows.filter((row) => row.required === 'true').map((row) => row.key);
  assert.deepEqual(requiredKeys.sort(), ['failure_class', 'nextAction', 'result']);
});
