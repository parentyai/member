'use strict';

function countUnsupportedClaims(claims) {
  const rows = Array.isArray(claims) ? claims : [];
  return rows.filter((row) => row && row.supported !== true).length;
}

module.exports = {
  countUnsupportedClaims
};
