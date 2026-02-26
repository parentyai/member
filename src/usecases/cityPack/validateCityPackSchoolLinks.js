'use strict';

const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');

function resolveSchoolSlotLinkRegistryId(cityPack) {
  const slotContents = cityPack && cityPack.slotContents && typeof cityPack.slotContents === 'object'
    ? cityPack.slotContents
    : {};
  const school = slotContents.school && typeof slotContents.school === 'object' ? slotContents.school : null;
  if (!school || typeof school.linkRegistryId !== 'string') return null;
  const linkRegistryId = school.linkRegistryId.trim();
  return linkRegistryId || null;
}

function normalizeSchoolType(value) {
  const schoolType = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return schoolType || 'unknown';
}

async function validateCityPackSchoolLinks(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const cityPack = payload.cityPack && typeof payload.cityPack === 'object' ? payload.cityPack : {};
  const getLink = deps && typeof deps.getLink === 'function' ? deps.getLink : linkRegistryRepo.getLink;

  const schoolLinkRegistryId = resolveSchoolSlotLinkRegistryId(cityPack);
  if (!schoolLinkRegistryId) {
    return {
      ok: true,
      schoolLinkRegistryId: null,
      schoolType: null,
      reason: null
    };
  }

  const link = await getLink(schoolLinkRegistryId);
  if (!link) {
    return {
      ok: false,
      schoolLinkRegistryId,
      schoolType: null,
      reason: 'school_link_registry_not_found'
    };
  }
  const schoolType = normalizeSchoolType(link.schoolType);
  if (schoolType !== 'public') {
    return {
      ok: false,
      schoolLinkRegistryId,
      schoolType,
      reason: 'school_link_not_public'
    };
  }
  return {
    ok: true,
    schoolLinkRegistryId,
    schoolType,
    reason: null
  };
}

module.exports = {
  validateCityPackSchoolLinks
};
