'use strict';

const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');

async function updateLink(id, patch) {
  return linkRegistryRepo.updateLink(id, patch || {});
}

module.exports = { updateLink };
