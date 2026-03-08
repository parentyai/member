'use strict';

const { appendDeliveryRecord } = require('./deliveryRecordsRepo');

async function writeEvidenceLedgerEntry(entry, deps) {
  const writer = deps && typeof deps.appendDeliveryRecord === 'function'
    ? deps.appendDeliveryRecord
    : appendDeliveryRecord;
  return writer(entry || {});
}

module.exports = {
  writeEvidenceLedgerEntry
};
