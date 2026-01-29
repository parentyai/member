'use strict';

const { getUser, updateUser } = require('../../repos/firestore/usersRepo');

async function setChecklistItemDone({ lineUserId, itemKey, done }) {
  if (!lineUserId) throw new Error('lineUserId required');
  if (!itemKey) throw new Error('itemKey required');
  const user = await getUser(lineUserId);
  if (!user) throw new Error('user not found');
  const existing = user.checklistDone && typeof user.checklistDone === 'object'
    ? Object.assign({}, user.checklistDone)
    : {};
  if (done) {
    existing[itemKey] = true;
  } else {
    delete existing[itemKey];
  }
  await updateUser(lineUserId, { checklistDone: existing });
  return { lineUserId, itemKey, done: Boolean(done) };
}

module.exports = {
  setChecklistItemDone
};
