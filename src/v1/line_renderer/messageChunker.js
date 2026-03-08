'use strict';

const { trimToUtf16Budget, countUtf16Units } = require('./utf16Budgeter');

function splitTextByUtf16(text, maxUnits) {
  const value = typeof text === 'string' ? text : '';
  const budget = Number.isFinite(Number(maxUnits)) ? Math.max(1, Math.floor(Number(maxUnits))) : 1000;
  if (!value) return [];
  if (countUtf16Units(value) <= budget) return [value];
  const chunks = [];
  let remain = value;
  while (remain.length > 0) {
    const head = trimToUtf16Budget(remain, budget);
    if (!head) break;
    chunks.push(head);
    remain = remain.slice(head.length);
  }
  if (remain.length > 0) {
    const tail = chunks.length ? chunks[chunks.length - 1] : '';
    chunks[chunks.length - 1] = `${tail.slice(0, Math.max(0, tail.length - 1))}…`;
  }
  return chunks;
}

module.exports = {
  splitTextByUtf16
};
