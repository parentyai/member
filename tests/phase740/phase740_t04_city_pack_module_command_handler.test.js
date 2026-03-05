'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleJourneyLineCommand } = require('../../src/usecases/journey/handleJourneyLineCommand');

function createPreferenceRepo(initialModules) {
  const state = {
    modulesSubscribed: Array.isArray(initialModules) ? initialModules.slice() : []
  };
  return {
    getUserCityPackPreference: async () => ({ lineUserId: 'U_TEST', modulesSubscribed: state.modulesSubscribed.slice() }),
    upsertUserCityPackPreference: async (_lineUserId, patch) => {
      state.modulesSubscribed = Array.isArray(patch && patch.modulesSubscribed) ? patch.modulesSubscribed.slice() : [];
      return { lineUserId: 'U_TEST', modulesSubscribed: state.modulesSubscribed.slice() };
    }
  };
}

test('phase740: CityPack案内 returns flex guide message', async () => {
  const prev = process.env.ENABLE_CITY_PACK_MODULE_SUBSCRIPTION_V1;
  process.env.ENABLE_CITY_PACK_MODULE_SUBSCRIPTION_V1 = '1';
  try {
    const result = await handleJourneyLineCommand({
      lineUserId: 'U_TEST',
      text: 'CityPack案内'
    }, {
      userCityPackPreferencesRepo: createPreferenceRepo([])
    });
    assert.equal(result.handled, true);
    assert.ok(result.replyMessage);
    assert.equal(result.replyMessage.type, 'flex');
  } finally {
    if (prev === undefined) delete process.env.ENABLE_CITY_PACK_MODULE_SUBSCRIPTION_V1;
    else process.env.ENABLE_CITY_PACK_MODULE_SUBSCRIPTION_V1 = prev;
  }
});

test('phase740: CityPack subscribe/unsubscribe updates preferences', async () => {
  const prev = process.env.ENABLE_CITY_PACK_MODULE_SUBSCRIPTION_V1;
  process.env.ENABLE_CITY_PACK_MODULE_SUBSCRIPTION_V1 = '1';
  const prefs = createPreferenceRepo(['schools', 'healthcare']);
  try {
    const subscribe = await handleJourneyLineCommand({
      lineUserId: 'U_TEST',
      text: 'CityPack購読:driving'
    }, {
      userCityPackPreferencesRepo: prefs
    });
    assert.equal(subscribe.handled, true);
    assert.match(subscribe.replyText, /CityPack購読を更新しました/);

    const unsubscribe = await handleJourneyLineCommand({
      lineUserId: 'U_TEST',
      text: 'CityPack解除:schools'
    }, {
      userCityPackPreferencesRepo: prefs
    });
    assert.equal(unsubscribe.handled, true);
    assert.match(unsubscribe.replyText, /CityPack購読を更新しました/);
  } finally {
    if (prev === undefined) delete process.env.ENABLE_CITY_PACK_MODULE_SUBSCRIPTION_V1;
    else process.env.ENABLE_CITY_PACK_MODULE_SUBSCRIPTION_V1 = prev;
  }
});
