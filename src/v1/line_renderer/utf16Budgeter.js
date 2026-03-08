'use strict';

function countUtf16Units(text) {
  if (typeof text !== 'string' || !text.length) return 0;
  return [...text].reduce((total, ch) => {
    const code = ch.codePointAt(0);
    return total + (code > 0xffff ? 2 : 1);
  }, 0);
}

function trimToUtf16Budget(text, maxUnits) {
  const value = typeof text === 'string' ? text : '';
  const budget = Number.isFinite(Number(maxUnits)) ? Math.max(0, Math.floor(Number(maxUnits))) : 0;
  if (!budget) return '';
  let used = 0;
  let out = '';
  for (const ch of value) {
    const units = ch.codePointAt(0) > 0xffff ? 2 : 1;
    if (used + units > budget) break;
    out += ch;
    used += units;
  }
  return out;
}

module.exports = {
  countUtf16Units,
  trimToUtf16Budget
};
