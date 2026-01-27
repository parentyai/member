'use strict';

const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');

async function checkLinkHealth(id, health) {
  return linkRegistryRepo.setHealth(id, health || {});
}

module.exports = { checkLinkHealth };
