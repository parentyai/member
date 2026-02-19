'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase274: template library route exposes list/create/detail/activate/retire', () => {
  const file = readFileSync('src/routes/admin/cityPackTemplateLibrary.js', 'utf8');
  assert.match(file, /\/api\/admin\/city-pack-template-library/);
  assert.match(file, /parseDetail/);
  assert.match(file, /parseAction/);
  assert.match(file, /city_pack\.template_library\.create/);
  assert.match(file, /city_pack\.template_library\.\$\{action\}/);
});

test('phase274: template library repo uses city_pack_template_library collection', () => {
  const file = readFileSync('src/repos/firestore/cityPackTemplateLibraryRepo.js', 'utf8');
  assert.match(file, /COLLECTION = 'city_pack_template_library'/);
  assert.match(file, /createTemplate/);
  assert.match(file, /listTemplates/);
});
