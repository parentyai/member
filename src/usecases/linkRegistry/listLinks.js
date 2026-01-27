'use strict';

const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');

async function listLinks(params) {
  return linkRegistryRepo.listLinks(params || {});
}

module.exports = { listLinks };
