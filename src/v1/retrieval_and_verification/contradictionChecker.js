'use strict';

function detectContradiction(pairs) {
  const rows = Array.isArray(pairs) ? pairs : [];
  return rows.some((row) => row && row.contradicted === true);
}

module.exports = {
  detectContradiction
};
