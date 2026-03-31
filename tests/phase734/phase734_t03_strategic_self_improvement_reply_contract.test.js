'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const scenarios = require('../../tools/line_desktop_patrol/scenarios/strategic_self_improvement_batch_v1.json');
const exploreLibrary = require('../../tools/line_desktop_patrol/scenarios/strategic_self_improvement_explore_library_v1.json');
const { generatePaidDomainConciergeReply } = require('../../src/usecases/assistant/generatePaidDomainConciergeReply');
const { generatePaidCasualReply } = require('../../src/usecases/assistant/generatePaidCasualReply');
const { verifyCandidate } = require('../../src/domain/llm/orchestrator/verifyCandidate');

function countLines(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .length;
}

function hasQuestion(text) {
  return /[?？]/.test(String(text || ''));
}

function buildCityHint() {
  return {
    kind: 'city',
    cityKey: 'new-york',
    regionKey: 'NY::new-york',
    state: 'NY'
  };
}

function buildScenarioParams(caseId) {
  switch (caseId) {
    case 'direct_answer_school_start':
      return {
        domainIntent: 'school',
        messageText: 'ニューヨークの学校手続きで最初に確認することを2点だけ教えて。',
        requestContract: {
          requestShape: 'summarize',
          primaryDomainIntent: 'school',
          domainSignals: ['school'],
          locationHint: buildCityHint(),
          detailObligations: ['avoid_question_back']
        }
      };
    case 'priority_pick_without_wobble':
      return {
        domainIntent: 'school',
        messageText: 'その2点のうち、先に確認する方を1つだけ決めて。',
        requestContract: {
          requestShape: 'followup_continue',
          depthIntent: 'followup_continue',
          primaryDomainIntent: 'school',
          sourceReplyText: '最初に確認するのは、受付期限と必要書類の2点です。',
          detailObligations: ['avoid_question_back']
        }
      };
    case 'correction_recovery_housing':
      return {
        domainIntent: 'housing',
        messageText: '学校ではなく住居手続きだった。最初の確認事項を2点だけ言い直して。',
        requestContract: {
          requestShape: 'correction',
          primaryDomainIntent: 'housing',
          domainSignals: ['housing', 'school'],
          detailObligations: ['respect_correction', 'avoid_question_back']
        }
      };
    case 'city_specificity_new_york_city':
      return {
        domainIntent: 'school',
        messageText: 'ニューヨーク市の学校手続きだとしたら、最初の確認先を1つだけ言って。',
        requestContract: {
          requestShape: 'answer',
          primaryDomainIntent: 'school',
          knowledgeScope: 'city',
          locationHint: buildCityHint(),
          detailObligations: ['avoid_question_back']
        }
      };
    case 'official_confirmation_guard':
      return {
        domainIntent: 'school',
        messageText: '学校手続きで、あとで公式確認が必要になる点を1つだけ教えて。',
        requestContract: {
          requestShape: 'answer',
          primaryDomainIntent: 'school',
          detailObligations: ['avoid_question_back']
        }
      };
    case 'parent_friendly_rephrase':
      return {
        domainIntent: 'school',
        messageText: '学校手続きの話を、小学生の保護者向けに、やさしい日本語で1文にして。',
        requestContract: {
          requestShape: 'rewrite',
          outputForm: 'one_line',
          primaryDomainIntent: 'school',
          sourceReplyText: '最初に確認するのは、受付期限と必要書類の2点です。',
          detailObligations: ['avoid_question_back', 'one_line_only']
        }
      };
    case 'single_todo_now':
      return {
        domainIntent: 'school',
        messageText: '学校手続きで今日やることを1個だけ、命令形で言って。',
        requestContract: {
          requestShape: 'answer',
          primaryDomainIntent: 'school',
          detailObligations: ['avoid_question_back']
        }
      };
    case 'document_pair_specificity':
      return {
        domainIntent: 'school',
        messageText: '学校手続きの必要書類を2つだけ挙げて。',
        followupIntent: 'docs_required',
        requestContract: {
          requestShape: 'answer',
          primaryDomainIntent: 'school',
          detailObligations: ['avoid_question_back']
        }
      };
    case 'reservation_pointer':
      return {
        domainIntent: 'school',
        messageText: '学校手続きで予約が必要かどうかは、どこを見れば分かる？1文で。',
        followupIntent: 'appointment_needed',
        requestContract: {
          requestShape: 'answer',
          outputForm: 'one_line',
          primaryDomainIntent: 'school',
          detailObligations: ['avoid_question_back', 'one_line_only']
        }
      };
    case 'close_with_two_line_plan':
      return {
        domainIntent: 'school',
        messageText: '学校手続きで最後に、今日やる順番を2行でまとめて。',
        requestContract: {
          requestShape: 'summarize',
          outputForm: 'two_sentences',
          primaryDomainIntent: 'school',
          detailObligations: ['avoid_question_back', 'two_sentences_only']
        }
      };
    default:
      throw new Error(`Unhandled scenario: ${caseId}`);
  }
}

function buildExploreScenarioParams(caseId) {
  switch (caseId) {
    case 'city_unknown_common_guard':
      return {
        domainIntent: 'school',
        messageText: '都市がまだ決まっていない前提で、共通して先に確認することを1つだけ。',
        requestContract: {
          requestShape: 'answer',
          primaryDomainIntent: 'school',
          detailObligations: ['avoid_question_back']
        }
      };
    case 'official_confirmation_direct':
      return {
        domainIntent: 'school',
        messageText: '公式に戻るべき確認点を1つだけ、逃げずに言って。',
        requestContract: {
          requestShape: 'answer',
          primaryDomainIntent: 'school',
          detailObligations: ['avoid_question_back']
        }
      };
    default:
      throw new Error(`Unhandled explore scenario: ${caseId}`);
  }
}

test('phase734: strategic self-improvement prompts stay human-direct under fixed reply contracts', () => {
  scenarios.cases.forEach((scenario) => {
    const result = generatePaidDomainConciergeReply(buildScenarioParams(scenario.case_id));
    const replyText = String(result.replyText || '');
    const replyContract = scenario.reply_contract || {};

    assert.equal(result.ok, true, `${scenario.case_id}: reply generation failed`);
    assert.equal(typeof result.procedurePacket, 'object', `${scenario.case_id}: missing procedure packet`);
    assert.equal(Array.isArray(result.procedurePacket.overallFlow), true, `${scenario.case_id}: missing overall flow`);
    assert.equal(result.procedurePacket.overallFlow.length >= 1, true, `${scenario.case_id}: empty overall flow`);
    assert.equal(typeof result.procedurePacket.nextBestAction, 'string', `${scenario.case_id}: missing next best action`);
    assert.equal(result.procedurePacket.nextBestAction.length > 0, true, `${scenario.case_id}: empty next best action`);
    assert.equal(Array.isArray(result.procedurePacket.troublePoints), true, `${scenario.case_id}: missing trouble points`);
    assert.equal(Array.isArray(result.procedurePacket.goodToDo), true, `${scenario.case_id}: missing good-to-do list`);
    assert.equal(Array.isArray(result.procedurePacket.officialCheckTargets), true, `${scenario.case_id}: missing official check targets`);
    assert.equal(
      countLines(replyText) <= Number(replyContract.max_lines || 99),
      true,
      `${scenario.case_id}: line overflow: ${replyText}`
    );
    assert.equal(
      replyText.length <= Number(replyContract.max_chars || 999),
      true,
      `${scenario.case_id}: char overflow (${replyText.length}): ${replyText}`
    );
    if (replyContract.disallow_question === true) {
      assert.equal(hasQuestion(replyText), false, `${scenario.case_id}: unexpected question-back: ${replyText}`);
    }
    assert.equal(
      (Array.isArray(replyContract.must_include_any) ? replyContract.must_include_any : []).some((token) => replyText.includes(token)),
      true,
      `${scenario.case_id}: missing required token: ${replyText}`
    );
    (Array.isArray(scenario.forbidden_reply_substrings) ? scenario.forbidden_reply_substrings : []).forEach((token) => {
      assert.equal(replyText.includes(token), false, `${scenario.case_id}: forbidden token ${token}: ${replyText}`);
    });
    ['FAQ候補', 'CityPack候補', '根拠キー'].forEach((token) => {
      assert.equal(replyText.includes(token), false, `${scenario.case_id}: legacy retrieval dump leaked: ${replyText}`);
    });
  });
});

test('phase734: casual contract reply keeps strategic direct answer for reservation pointer prompt', () => {
  const reply = generatePaidCasualReply({
    messageText: '予約が必要かどうかは、どこを見れば分かる？1文で。',
    contextHint: 'school',
    requestContract: {
      requestShape: 'summarize',
      outputForm: 'one_line',
      primaryDomainIntent: 'school'
    }
  });

  assert.equal(reply.ok, true);
  assert.equal(countLines(reply.replyText), 1);
  assert.equal(reply.replyText.includes('予約'), true);
  assert.equal(
    reply.replyText.includes('窓口')
      || reply.replyText.includes('公式')
      || reply.replyText.includes('office')
      || reply.replyText.includes('案内'),
    true
  );
  assert.equal(hasQuestion(reply.replyText), false);
  assert.equal(typeof reply.procedurePacket, 'object');
  assert.equal(Array.isArray(reply.nextSteps), true);
  assert.equal(reply.nextSteps.length >= 1, true);
});

test('phase734: focused explore prompts stay grounded instead of collapsing to generic fallback', () => {
  const targetedCases = new Set(['city_unknown_common_guard', 'official_confirmation_direct']);
  exploreLibrary.cases
    .filter((scenario) => targetedCases.has(scenario.case_id))
    .forEach((scenario) => {
      const result = generatePaidDomainConciergeReply(buildExploreScenarioParams(scenario.case_id));
      const replyText = String(result.replyText || '');
      const replyContract = scenario.reply_contract || {};

      assert.equal(result.ok, true, `${scenario.case_id}: reply generation failed`);
      assert.equal(countLines(replyText) <= Number(replyContract.max_lines || 99), true, `${scenario.case_id}: line overflow: ${replyText}`);
      assert.equal(replyText.length <= Number(replyContract.max_chars || 999), true, `${scenario.case_id}: char overflow (${replyText.length}): ${replyText}`);
      if (replyContract.disallow_question === true) {
        assert.equal(hasQuestion(replyText), false, `${scenario.case_id}: unexpected question-back: ${replyText}`);
      }
      assert.equal(
        (Array.isArray(replyContract.must_include_any) ? replyContract.must_include_any : []).some((token) => replyText.includes(token)),
        true,
        `${scenario.case_id}: missing required token: ${replyText}`
      );
      (Array.isArray(scenario.forbidden_reply_substrings) ? scenario.forbidden_reply_substrings : []).forEach((token) => {
        assert.equal(replyText.includes(token), false, `${scenario.case_id}: forbidden token ${token}: ${replyText}`);
      });
      assert.notEqual(
        replyText,
        'まずは優先する1件だけ決める形で進めると、無理が少なそうです。',
        `${scenario.case_id}: generic fallback leaked: ${replyText}`
      );
    });
});

test('phase734: verifier fallback stays specific for focused explore prompts', () => {
  const cityUnknownVerified = verifyCandidate({
    packet: {
      messageText: '都市がまだ決まっていない前提で、共通して先に確認することを1つだけ。',
      normalizedConversationIntent: 'school',
      primaryDomainIntent: 'school',
      requestShape: 'answer',
      requestContract: {
        requestShape: 'answer',
        primaryDomainIntent: 'school'
      },
      recentAssistantCommitments: []
    },
    selected: {
      id: 'generic_candidate',
      kind: 'grounded_candidate',
      replyText: 'まずは優先する1件だけ決める形で進めると、無理が少なそうです。'
    },
    evidenceSufficiency: 'full'
  });

  assert.equal(cityUnknownVerified.selected.replyText.includes('自治体'), true);
  assert.equal(cityUnknownVerified.selected.replyText.includes('窓口') || cityUnknownVerified.selected.replyText.includes('公式'), true);
  assert.equal(hasQuestion(cityUnknownVerified.selected.replyText), false);

  const officialVerified = verifyCandidate({
    packet: {
      messageText: '公式に戻るべき確認点を1つだけ、逃げずに言って。',
      normalizedConversationIntent: 'school',
      primaryDomainIntent: 'school',
      requestShape: 'answer',
      requestContract: {
        requestShape: 'answer',
        primaryDomainIntent: 'school'
      },
      recentAssistantCommitments: []
    },
    selected: {
      id: 'generic_candidate',
      kind: 'grounded_candidate',
      replyText: 'まずは優先する1件だけ決める形で進めると、無理が少なそうです。'
    },
    evidenceSufficiency: 'full'
  });

  assert.equal(officialVerified.selected.replyText.includes('公式'), true);
  assert.equal(
    officialVerified.selected.replyText.includes('窓口')
      || officialVerified.selected.replyText.includes('期限')
      || officialVerified.selected.replyText.includes('受付スケジュール'),
    true
  );
  assert.equal(hasQuestion(officialVerified.selected.replyText), false);
});

test('phase734: verifier fallback converts awkward close-out into strategic two-line plan', () => {
  const verified = verifyCandidate({
    packet: {
      messageText: '最後に、今日やる順番を2行でまとめて。',
      normalizedConversationIntent: 'school',
      primaryDomainIntent: 'school',
      requestShape: 'summarize',
      outputForm: 'two_sentences',
      requestContract: {
        requestShape: 'summarize',
        outputForm: 'two_sentences',
        primaryDomainIntent: 'school'
      },
      recentAssistantCommitments: []
    },
    selected: {
      id: 'generic_candidate',
      kind: 'grounded_candidate',
      replyText: 'まずは優先する1件だけ決める形で進めると、無理が少なそうです。'
    },
    evidenceSufficiency: 'full'
  });

  assert.equal(
    verified.selected.replyText.includes('期限')
      || verified.selected.replyText.includes('受付スケジュール'),
    true
  );
  assert.equal(verified.selected.replyText.includes('必要書類') || verified.selected.replyText.includes('予約'), true);
  assert.equal(countLines(verified.selected.replyText), 2);
});
