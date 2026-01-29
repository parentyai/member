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
