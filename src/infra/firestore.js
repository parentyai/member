'use strict';

let adminCache = null;
let testDb = null;
let serverTimestampOverride = null;

function getAdmin() {
  if (adminCache) return adminCache;
  adminCache = require('firebase-admin');
  return adminCache;
}

function getDb() {
  if (testDb) return testDb;
  const admin = getAdmin();
  if (admin.apps.length === 0) {
    admin.initializeApp({ projectId: process.env.FIRESTORE_PROJECT_ID });
  }
  return admin.firestore();
}

function serverTimestamp() {
  if (serverTimestampOverride !== null) return serverTimestampOverride;
  const admin = getAdmin();
  return admin.firestore.FieldValue.serverTimestamp();
}

function setDbForTest(db) {
  testDb = db;
}

function clearDbForTest() {
  testDb = null;
}

function setServerTimestampForTest(value) {
  serverTimestampOverride = value;
}

function clearServerTimestampForTest() {
  serverTimestampOverride = null;
}

module.exports = {
  getDb,
  serverTimestamp,
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
};
