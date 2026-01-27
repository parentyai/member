'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');

async function listNotifications(params) {
  return notificationsRepo.listNotifications(params || {});
}

module.exports = {
  listNotifications
};
