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
