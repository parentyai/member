// LEGACY_FROZEN_DO_NOT_USE
// reason: unreachable from current src/index.js route graph baseline (REPO_FULL_AUDIT_REPORT_2026-02-21).
// ssot_ref: docs/REPO_FULL_AUDIT_REPORT_2026-02-21.md
'use strict';

const { getUser } = require('../../repos/firestore/usersRepo');

async function getMemberProfile({ lineUserId }) {
  if (!lineUserId) throw new Error('lineUserId required');
  const user = await getUser(lineUserId);
  if (!user) throw new Error('user not found');
  return {
    lineUserId: user.id,
    memberNumber: user.memberNumber || null
  };
}

module.exports = {
  getMemberProfile
};
