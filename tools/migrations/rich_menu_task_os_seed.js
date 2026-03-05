'use strict';

const { getDb, serverTimestamp } = require('../../src/infra/firestore');
const richMenuTemplatesRepo = require('../../src/repos/firestore/richMenuTemplatesRepo');
const richMenuAssignmentRulesRepo = require('../../src/repos/firestore/richMenuAssignmentRulesRepo');
const richMenuPhaseProfilesRepo = require('../../src/repos/firestore/richMenuPhaseProfilesRepo');
const richMenuBindingsRepo = require('../../src/repos/firestore/richMenuBindingsRepo');
const richMenuPolicyRepo = require('../../src/repos/firestore/richMenuPolicyRepo');

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  const toValue = (prefix, fallback) => {
    const hit = args.find((item) => item.startsWith(`${prefix}=`));
    if (!hit) return fallback;
    const value = hit.slice(prefix.length + 1).trim();
    return value || fallback;
  };
  const toList = (prefix) => {
    const value = toValue(prefix, '');
    if (!value) return [];
    const out = [];
    value.split(',').forEach((item) => {
      const normalized = String(item || '').trim();
      if (!normalized) return;
      if (out.includes(normalized)) return;
      out.push(normalized);
    });
    return out;
  };
  return {
    apply: args.includes('--apply'),
    enablePolicy: args.includes('--enable-policy'),
    templateId: toValue('--template-id', 'task_os_entry_v1'),
    ruleId: toValue('--rule-id', 'task_os_default_v1'),
    phaseId: toValue('--phase-id', 'pre_departure'),
    locale: toValue('--locale', 'ja').toLowerCase(),
    lineUserIds: toList('--line-users')
  };
}

function buildTemplate(templateId, locale) {
  return {
    templateId,
    kind: 'default',
    status: 'active',
    target: {
      planTier: null,
      phaseId: null,
      locale
    },
    layout: {
      size: 'large',
      areas: [
        {
          label: '今日の3つ',
          bounds: { x: 0, y: 0, width: 833, height: 843 },
          actionType: 'message',
          actionPayload: { text: '今日の3つ' }
        },
        {
          label: 'やること一覧',
          bounds: { x: 833, y: 0, width: 834, height: 843 },
          actionType: 'message',
          actionPayload: { text: 'TODO一覧' }
        },
        {
          label: 'カテゴリ',
          bounds: { x: 1667, y: 0, width: 833, height: 843 },
          actionType: 'message',
          actionPayload: { text: 'カテゴリ' }
        },
        {
          label: 'CityPack',
          bounds: { x: 0, y: 843, width: 833, height: 843 },
          actionType: 'message',
          actionPayload: { text: 'CityPack案内' }
        },
        {
          label: '通知履歴',
          bounds: { x: 833, y: 843, width: 834, height: 843 },
          actionType: 'message',
          actionPayload: { text: '通知履歴' }
        },
        {
          label: '相談',
          bounds: { x: 1667, y: 843, width: 833, height: 843 },
          actionType: 'message',
          actionPayload: { text: '相談' }
        }
      ]
    },
    lineMeta: {
      richMenuId: '',
      aliasId: null,
      imageAssetPath: null
    },
    version: 1,
    archived: false,
    description: 'Task OS rich menu entry (today, todo list, category, citypack, history, support)',
    labels: ['task_os', 'entry', 'line']
  };
}

function buildAssignmentRule(ruleId, templateId, locale) {
  return {
    ruleId,
    kind: 'default',
    status: 'active',
    templateId,
    priority: 100,
    target: {
      planTier: null,
      phaseId: null,
      locale
    },
    description: 'Task OS default assignment rule'
  };
}

function buildPhaseProfile(phaseId) {
  return {
    phaseId,
    status: 'active',
    label: 'US Assignment Phase',
    journeyStageMatchers: ['pre_departure', 'departure_ready', 'assigned', 'arrived'],
    description: 'Task OS phase profile seed'
  };
}

function buildPolicy(templateId, enablePolicy) {
  return {
    enabled: enablePolicy === true,
    updateEnabled: true,
    defaultTemplateId: templateId,
    fallbackTemplateId: templateId,
    cooldownSeconds: 21600,
    maxAppliesPerMinute: 60,
    maxTargetsPerApply: 200,
    allowLegacyJourneyPolicyFallback: true
  };
}

function buildBinding(lineUserId, templateId, ruleId, phaseId) {
  return {
    lineUserId,
    currentMenuKey: 'task_os_entry',
    currentRichMenuId: null,
    currentTemplateId: templateId,
    previousTemplateId: null,
    resolvedRuleId: ruleId,
    planTier: null,
    phaseId,
    lastApplyResult: {
      ok: true,
      source: 'seed_script',
      mode: 'apply'
    },
    lastTraceId: 'rich-menu-task-os-seed',
    nextEligibleAt: null,
    manualOverrideTemplateId: null,
    appliedAt: new Date().toISOString(),
    lastError: null
  };
}

async function run() {
  const options = parseArgs(process.argv);
  const templateCandidate = richMenuTemplatesRepo.normalizeRichMenuTemplate(
    buildTemplate(options.templateId, options.locale),
    options.templateId
  );
  const ruleCandidate = richMenuAssignmentRulesRepo.normalizeRichMenuAssignmentRule(
    buildAssignmentRule(options.ruleId, options.templateId, options.locale),
    options.ruleId
  );
  const phaseCandidate = richMenuPhaseProfilesRepo.normalizeRichMenuPhaseProfile(
    buildPhaseProfile(options.phaseId),
    options.phaseId
  );
  const policyCandidate = richMenuPolicyRepo.normalizeRichMenuPolicy(
    buildPolicy(options.templateId, options.enablePolicy)
  );

  const invalid = [];
  if (!templateCandidate) invalid.push('template');
  if (!ruleCandidate) invalid.push('assignment_rule');
  if (!phaseCandidate) invalid.push('phase_profile');
  if (!policyCandidate) invalid.push('policy');
  if (invalid.length) {
    throw new Error(`invalid_seed_payload:${invalid.join(',')}`);
  }

  const bindingCandidates = options.lineUserIds
    .map((lineUserId) => richMenuBindingsRepo.normalizeBinding(
      lineUserId,
      buildBinding(lineUserId, templateCandidate.templateId, ruleCandidate.ruleId, phaseCandidate.phaseId)
    ))
    .filter((item) => item && item.lineUserId);

  const summary = {
    apply: options.apply,
    enablePolicy: options.enablePolicy,
    templateId: templateCandidate.templateId,
    ruleId: ruleCandidate.ruleId,
    phaseId: phaseCandidate.phaseId,
    locale: options.locale,
    bindingCount: bindingCandidates.length
  };

  if (!options.apply) {
    console.log(JSON.stringify({
      ok: true,
      mode: 'dry-run',
      summary,
      template: templateCandidate,
      assignmentRule: ruleCandidate,
      phaseProfile: phaseCandidate,
      policy: policyCandidate,
      bindings: bindingCandidates
    }, null, 2));
    return;
  }

  const db = getDb();
  await db.collection(richMenuTemplatesRepo.COLLECTION).doc(templateCandidate.templateId).set(Object.assign({}, templateCandidate, {
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedBy: 'migration:rich_menu_task_os_seed',
    createdBy: 'migration:rich_menu_task_os_seed'
  }), { merge: true });
  await db.collection(richMenuAssignmentRulesRepo.COLLECTION).doc(ruleCandidate.ruleId).set(Object.assign({}, ruleCandidate, {
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedBy: 'migration:rich_menu_task_os_seed',
    createdBy: 'migration:rich_menu_task_os_seed'
  }), { merge: true });
  await db.collection(richMenuPhaseProfilesRepo.COLLECTION).doc(phaseCandidate.phaseId).set(Object.assign({}, phaseCandidate, {
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedBy: 'migration:rich_menu_task_os_seed',
    createdBy: 'migration:rich_menu_task_os_seed'
  }), { merge: true });
  await db.collection(richMenuPolicyRepo.COLLECTION).doc(richMenuPolicyRepo.DOC_ID).set(Object.assign({}, policyCandidate, {
    updatedAt: serverTimestamp(),
    updatedBy: 'migration:rich_menu_task_os_seed'
  }), { merge: true });

  for (const binding of bindingCandidates) {
    // eslint-disable-next-line no-await-in-loop
    await db.collection(richMenuBindingsRepo.COLLECTION).doc(binding.lineUserId).set(Object.assign({}, binding, {
      updatedAt: serverTimestamp(),
      appliedAt: serverTimestamp()
    }), { merge: true });
  }

  console.log(JSON.stringify({
    ok: true,
    mode: 'apply',
    summary
  }, null, 2));
}

run().catch((err) => {
  console.error(JSON.stringify({
    ok: false,
    error: err && err.message ? err.message : 'error'
  }));
  process.exitCode = 1;
});
