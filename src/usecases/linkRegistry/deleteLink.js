'use strict';

const { getDb } = require('../../infra/firestore');

async function deleteLink(id) {
  if (!id) throw new Error('link id required');
  const db = getDb();
  await db.collection('link_registry').doc(id).delete();
  return { id };
}

module.exports = { deleteLink };
