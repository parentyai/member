'use strict';

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') {
    const ms = value.toMillis();
    return Number.isFinite(ms) ? ms : 0;
  }
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 0 : value.getTime();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }
  return 0;
}

function sortByTimestampDesc(rows, fieldName) {
  const list = Array.isArray(rows) ? rows : [];
  list.sort((a, b) => {
    const left = toMillis(a && a[fieldName]);
    const right = toMillis(b && b[fieldName]);
    if (left !== right) return right - left;
    return String(b && b.id || '').localeCompare(String(a && a.id || ''));
  });
  return list;
}

function sortByNumberDesc(rows, fieldName) {
  const list = Array.isArray(rows) ? rows : [];
  list.sort((a, b) => {
    const left = Number(a && a[fieldName]);
    const right = Number(b && b[fieldName]);
    const leftNum = Number.isFinite(left) ? left : 0;
    const rightNum = Number.isFinite(right) ? right : 0;
    if (leftNum !== rightNum) return rightNum - leftNum;
    return String(b && b.id || '').localeCompare(String(a && a.id || ''));
  });
  return list;
}

function isMissingIndexError(err) {
  if (!err) return false;
  const code = err.code;
  if (code === 9 || code === '9' || code === 'FAILED_PRECONDITION') return true;
  const message = typeof err.message === 'string' ? err.message : '';
  return message.includes('requires an index') || message.includes('FAILED_PRECONDITION');
}

module.exports = {
  toMillis,
  sortByTimestampDesc,
  sortByNumberDesc,
  isMissingIndexError
};
