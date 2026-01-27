'use strict';

const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');

async function setKillSwitch(isOn) {
  return systemFlagsRepo.setKillSwitch(Boolean(isOn));
}

async function getKillSwitch() {
  return systemFlagsRepo.getKillSwitch();
}

module.exports = {
  setKillSwitch,
  getKillSwitch
};
