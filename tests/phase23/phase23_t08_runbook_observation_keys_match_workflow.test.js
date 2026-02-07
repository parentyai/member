import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const runbook = readFileSync('docs/PHASE23_RUNBOOK.md', 'utf8');
const dryrun = readFileSync('.github/workflows/phase22-scheduled-dryrun.yml', 'utf8');
const write = readFileSync('.github/workflows/phase22-scheduled-write.yml', 'utf8');

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

function extractSummaryKeys(contents) {
  const keys = new Set();
  const regex = /echo\s+"([a-zA-Z_]+):\s*\$\{/g;
  let match;
  while ((match = regex.exec(contents)) !== null) {
    keys.add(match[1]);
  }
  return keys;
}

test('phase23 t08: observation keys match workflow summary keys', () => {
  const tables = parseTables(runbook);
  const observation = tables.find((table) => {
    const cols = parseHeader(table);
    return cols[0] === 'key' && cols[1] === 'required' && cols[2] === 'notes';
  });
  assert.ok(observation, 'observation keys table not found');
  const obsHeader = parseHeader(observation);
  const obsRows = parseRows(observation, obsHeader);
  const obsKeys = new Set(obsRows.map((row) => row.key));

  const workflowKeys = new Set([
    ...extractSummaryKeys(dryrun),
    ...extractSummaryKeys(write)
  ]);

  assert.deepEqual([...obsKeys].sort(), [...workflowKeys].sort());
});
