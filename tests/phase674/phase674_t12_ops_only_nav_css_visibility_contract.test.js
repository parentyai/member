'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function findRule(css, selector) {
  const index = css.indexOf(selector);
  assert.ok(index >= 0, `missing selector: ${selector}`);
  const blockStart = css.indexOf('{', index);
  const blockEnd = css.indexOf('}', blockStart);
  assert.ok(blockStart >= 0 && blockEnd > blockStart, `invalid css block: ${selector}`);
  return {
    index,
    selector,
    body: css.slice(blockStart + 1, blockEnd)
  };
}

function parseDisplayDecl(ruleBody, selector) {
  const match = ruleBody.match(/display:\s*([^;]+);/);
  assert.ok(match, `display declaration missing: ${selector}`);
  const rawValue = match[1].trim();
  return {
    selector,
    value: rawValue.replace(/\s*!important\s*/g, '').trim(),
    important: /!important/.test(rawValue)
  };
}

function resolveDisplayCascade(displayDecls) {
  let winner = null;
  for (const decl of displayDecls) {
    if (!winner) {
      winner = decl;
      continue;
    }
    if (decl.important && !winner.important) {
      winner = decl;
      continue;
    }
    if (decl.important === winner.important) {
      winner = decl;
    }
  }
  return winner ? winner.value : null;
}

test('phase674: ops-only nav v1 class is wired in applyOpsOnlyChrome', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(js.includes("appShell.classList.toggle('ops-only-nav-v1', ADMIN_OPS_ONLY_NAV_V1);"));
});

test('phase674: ops-only nav v1 css overrides are defined after legacy nav-group whitelist rule', () => {
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  const legacyGroupHide = findRule(
    css,
    '.app-nav .nav-group:not(.nav-group-dashboard):not(.nav-group-notifications):not(.nav-group-users):not(.nav-group-catalog):not(.nav-group-developer)'
  );
  const groupShowOverride = findRule(
    css,
    '.app-shell.ops-only-nav-v1 .app-nav .nav-group[data-nav-visible="true"]'
  );
  const groupHideOverride = findRule(
    css,
    '.app-shell.ops-only-nav-v1 .app-nav .nav-group[data-nav-visible="false"]'
  );
  const itemShowOverride = findRule(
    css,
    '.app-shell.ops-only-nav-v1 .app-nav .nav-item[data-nav-item-visible="true"]'
  );
  const itemHideOverride = findRule(
    css,
    '.app-shell.ops-only-nav-v1 .app-nav .nav-item[data-nav-item-visible="false"]'
  );

  assert.ok(groupShowOverride.index > legacyGroupHide.index, 'ops-only group show override must win by order');
  assert.ok(groupHideOverride.index > legacyGroupHide.index, 'ops-only group hide override must be after legacy rule');
  assert.ok(itemShowOverride.index > legacyGroupHide.index, 'ops-only item show override must be after legacy rule');
  assert.ok(itemHideOverride.index > legacyGroupHide.index, 'ops-only item hide override must be after legacy rule');

  assert.ok(groupShowOverride.body.includes('display: grid !important;'));
  assert.ok(groupHideOverride.body.includes('display: none !important;'));
  assert.ok(itemShowOverride.body.includes('display: flex !important;'));
  assert.ok(itemHideOverride.body.includes('display: none !important;'));
});

test('phase674: ops-only nav v1 cascade keeps data-nav-visible=true shown and false hidden', () => {
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  const legacyGroupHide = findRule(
    css,
    '.app-nav .nav-group:not(.nav-group-dashboard):not(.nav-group-notifications):not(.nav-group-users):not(.nav-group-catalog):not(.nav-group-developer)'
  );
  const groupVisible = findRule(css, '.app-nav .nav-group[data-nav-visible="true"]');
  const groupHidden = findRule(css, '.app-nav .nav-group[data-nav-visible="false"]');
  const itemVisible = findRule(css, '.app-nav .nav-item[data-nav-item-visible="true"]');
  const itemHidden = findRule(css, '.app-nav .nav-item[data-nav-item-visible="false"]');

  const groupVisibleOverride = findRule(
    css,
    '.app-shell.ops-only-nav-v1 .app-nav .nav-group[data-nav-visible="true"]'
  );
  const groupHiddenOverride = findRule(
    css,
    '.app-shell.ops-only-nav-v1 .app-nav .nav-group[data-nav-visible="false"]'
  );
  const itemVisibleOverride = findRule(
    css,
    '.app-shell.ops-only-nav-v1 .app-nav .nav-item[data-nav-item-visible="true"]'
  );
  const itemHiddenOverride = findRule(
    css,
    '.app-shell.ops-only-nav-v1 .app-nav .nav-item[data-nav-item-visible="false"]'
  );

  const computedGroupVisible = resolveDisplayCascade([
    parseDisplayDecl(legacyGroupHide.body, legacyGroupHide.selector),
    parseDisplayDecl(groupVisible.body, groupVisible.selector),
    parseDisplayDecl(groupVisibleOverride.body, groupVisibleOverride.selector)
  ]);
  const computedGroupHidden = resolveDisplayCascade([
    parseDisplayDecl(legacyGroupHide.body, legacyGroupHide.selector),
    parseDisplayDecl(groupHidden.body, groupHidden.selector),
    parseDisplayDecl(groupHiddenOverride.body, groupHiddenOverride.selector)
  ]);
  const computedItemVisible = resolveDisplayCascade([
    parseDisplayDecl(itemVisible.body, itemVisible.selector),
    parseDisplayDecl(itemVisibleOverride.body, itemVisibleOverride.selector)
  ]);
  const computedItemHidden = resolveDisplayCascade([
    parseDisplayDecl(itemHidden.body, itemHidden.selector),
    parseDisplayDecl(itemHiddenOverride.body, itemHiddenOverride.selector)
  ]);

  assert.equal(computedGroupVisible, 'grid');
  assert.notEqual(computedGroupVisible, 'none');
  assert.equal(computedGroupHidden, 'none');
  assert.equal(computedItemVisible, 'flex');
  assert.notEqual(computedItemVisible, 'none');
  assert.equal(computedItemHidden, 'none');
});
