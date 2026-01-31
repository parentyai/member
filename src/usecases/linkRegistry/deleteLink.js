'use strict';

const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');

async function deleteLink(id) {
  if (!id) throw new Error('link id required');
  await linkRegistryRepo.deleteLink(id);
  return { id };
}

module.exports = { deleteLink };
