'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  parseJourneyLineCommand,
  parseJourneyPostbackData
} = require('../../src/domain/journey/lineCommandParsers');
const { isCityPackModuleSubscribed } = require('../../src/usecases/cityPack/filterCityPackModules');

test('phase740: parser resolves CityPack guide and module subscribe commands', () => {
  const guide = parseJourneyLineCommand('CityPack案内');
  assert.ok(guide);
  assert.equal(guide.action, 'city_pack_module_guide');

  const subscribe = parseJourneyLineCommand('CityPack購読:schools');
  assert.ok(subscribe);
  assert.equal(subscribe.action, 'city_pack_module_subscribe');
  assert.equal(subscribe.module, 'schools');
});

test('phase740: parser resolves city pack module postback actions', () => {
  const status = parseJourneyPostbackData('action=city_pack_module_status');
  assert.ok(status);
  assert.equal(status.action, 'city_pack_module_status');

  const unsubscribe = parseJourneyPostbackData('action=city_pack_module_unsubscribe&module=driving');
  assert.ok(unsubscribe);
  assert.equal(unsubscribe.action, 'city_pack_module_unsubscribe');
  assert.equal(unsubscribe.module, 'driving');
});

test('phase740: module filter keeps compatibility for unset preference', () => {
  assert.equal(isCityPackModuleSubscribed({
    modulesUpdated: ['schools'],
    modulesSubscribed: []
  }), true);
  assert.equal(isCityPackModuleSubscribed({
    modulesUpdated: ['schools'],
    modulesSubscribed: ['driving']
  }), false);
  assert.equal(isCityPackModuleSubscribed({
    modulesUpdated: ['schools'],
    modulesSubscribed: ['schools', 'driving']
  }), true);
});
