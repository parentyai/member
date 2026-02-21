// LEGACY_FROZEN_DO_NOT_USE
// reason: unreachable from current src/index.js route graph baseline (REPO_FULL_AUDIT_REPORT_2026-02-21).
// ssot_ref: docs/REPO_FULL_AUDIT_REPORT_2026-02-21.md
'use strict';

const { setMemberNumber: setMemberNumberRepo } = require('../../repos/firestore/usersRepo');

async function setMemberNumber({ lineUserId, memberNumber }) {
  if (!lineUserId) throw new Error('lineUserId required');
  const value = typeof memberNumber === 'string' ? memberNumber.trim() : '';
  const next = value.length ? value : null;
  await setMemberNumberRepo(lineUserId, next);
  return { lineUserId, memberNumber: next };
}

module.exports = {
  setMemberNumber
};
