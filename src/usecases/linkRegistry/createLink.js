'use strict';

const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');

async function createLink(data) {
  return linkRegistryRepo.createLink(data || {});
}

module.exports = { createLink };
