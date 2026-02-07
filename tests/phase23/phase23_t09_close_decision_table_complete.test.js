import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const runbook = readFileSync('docs/PHASE23_RUNBOOK.md', 'utf8');

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

test('phase23 t09: close decision table exists and has required columns', () => {
  const tables = parseTables(runbook);
  const closeTable = tables.find((table) => {
    const cols = parseHeader(table);
    return cols[0] === 'phaseResult' && cols[1] === 'requiredEvidence' && cols[2] === 'closeDecision';
  });
  assert.ok(closeTable, 'close decision table not found');
  const header = parseHeader(closeTable);
  assert.deepEqual(header, ['phaseResult', 'requiredEvidence', 'closeDecision']);
});

test('phase23 t09: closeDecision values are CLOSE or NO_CLOSE', () => {
  const tables = parseTables(runbook);
  const closeTable = tables.find((table) => {
    const cols = parseHeader(table);
    return cols[0] === 'phaseResult' && cols[1] === 'requiredEvidence' && cols[2] === 'closeDecision';
  });
  assert.ok(closeTable, 'close decision table not found');
  const header = parseHeader(closeTable);
  const rows = parseRows(closeTable, header);
  for (const row of rows) {
    assert.ok(
      row.closeDecision === 'CLOSE' || row.closeDecision === 'NO_CLOSE',
      `invalid closeDecision: ${row.closeDecision}`
    );
  }
});
