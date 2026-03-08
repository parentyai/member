'use strict';

function runCounterexampleRegression(cases, judgeFn) {
  const rows = Array.isArray(cases) ? cases : [];
  const judge = typeof judgeFn === 'function' ? judgeFn : (() => ({ pass: true }));
  return rows.map((row) => {
    const result = judge(row);
    return {
      id: row && row.id ? row.id : null,
      pass: Boolean(result && result.pass === true),
      reason: result && result.reason ? result.reason : null
    };
  });
}

module.exports = {
  runCounterexampleRegression
};
