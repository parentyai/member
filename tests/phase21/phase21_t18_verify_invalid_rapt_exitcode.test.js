'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('phase21 t18: invalid_rapt classified as env error', async () => {
  const notifPath = require.resolve('../../src/repos/firestore/notificationsRepo');
  const sendPath = require.resolve('../../src/usecases/notifications/testSendNotification');
  const scriptPath = require.resolve('../../scripts/phase21_verify_day_window');

  const originalNotif = require.cache[notifPath];
  const originalSend = require.cache[sendPath];
  const originalScript = require.cache[scriptPath];

  require.cache[notifPath] = {
    id: notifPath,
    filename: notifPath,
    loaded: true,
    exports: {
      createNotification: () => {
        throw new Error('invalid_rapt reauth related error invalid_grant Getting metadata from plugin failed');
      }
    }
  };
  require.cache[sendPath] = {
    id: sendPath,
    filename: sendPath,
    loaded: true,
    exports: {
      testSendNotification: async () => ({ id: 'd1' })
    }
  };
  delete require.cache[scriptPath];

  const { main, handleMainError } = require('../../scripts/phase21_verify_day_window');

  const originalArgv = process.argv.slice();
  const originalExit = process.exit;
  const originalError = console.error;
  const originalGac = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  let exitCode = null;
  const stderr = [];

  process.argv = [
    'node',
    'scripts/phase21_verify_day_window.js',
    '--track-base-url',
    'https://example.com',
    '--linkRegistryId',
    'l1'
  ];
  process.env.GOOGLE_APPLICATION_CREDENTIALS = '';
  console.error = (...args) => {
    stderr.push(args.join(' '));
  };
  process.exit = (code) => {
    exitCode = code;
    throw new Error('exit');
  };

  try {
    await main();
  } catch (err) {
    if (err && err.message !== 'exit') {
      try {
        handleMainError(err);
      } catch (inner) {
        if (inner && inner.message !== 'exit') throw inner;
      }
    }
  } finally {
    process.argv = originalArgv;
    process.exit = originalExit;
    console.error = originalError;
    if (originalGac === undefined) {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    } else {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = originalGac;
    }
    if (originalNotif) {
      require.cache[notifPath] = originalNotif;
    } else {
      delete require.cache[notifPath];
    }
    if (originalSend) {
      require.cache[sendPath] = originalSend;
    } else {
      delete require.cache[sendPath];
    }
    if (originalScript) {
      require.cache[scriptPath] = originalScript;
    } else {
      delete require.cache[scriptPath];
    }
  }

  assert.equal(exitCode, 2);
  assert.ok(stderr.join('\n').includes('VERIFY_ENV_ERROR: ADC reauth required'));
});
