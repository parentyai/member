'use strict';

const usersRepo = require('../../repos/firestore/usersRepo');

const CHECKLISTS = Object.freeze({
  A: {
    '3mo': [
      { id: 'A-3mo-1', text: '住居エリアの候補整理（治安・通勤目安）' },
      { id: 'A-3mo-2', text: '米国携帯プランの基礎把握' },
      { id: 'A-3mo-3', text: '渡航スケジュール確認（入国日・仮滞在）' }
    ],
    '1mo': [
      { id: 'A-1mo-1', text: '住居探しの進め方を確認（内見・契約フロー）' },
      { id: 'A-1mo-2', text: '必要書類リスト確認（パスポート/ビザ等）' },
      { id: 'A-1mo-3', text: '米国銀行口座の基礎知識確認' }
    ],
    week: [
      { id: 'A-week-1', text: '初日〜1週目の行動チェック（SIM/交通/生活必需品）' },
      { id: 'A-week-2', text: '仮滞在先からの通勤確認' },
      { id: 'A-week-3', text: '緊急連絡先の確認' }
    ],
    after1w: [
      { id: 'A-after1w-1', text: '住居契約の最終確認' },
      { id: 'A-after1w-2', text: '携帯・銀行の利用開始確認' },
      { id: 'A-after1w-3', text: '生活インフラ（電気/ネット）の初期設定確認' }
    ]
  },
  C: {
    '3mo': [
      { id: 'C-3mo-1', text: '学区・学校制度の基本確認' },
      { id: 'C-3mo-2', text: '住居条件の優先順位整理（学区/通勤/治安）' },
      { id: 'C-3mo-3', text: '医療・保険制度の基礎把握' }
    ],
    '1mo': [
      { id: 'C-1mo-1', text: '学校手続きに必要な書類確認' },
      { id: 'C-1mo-2', text: '住居内見・契約準備' },
      { id: 'C-1mo-3', text: '車社会前提の生活準備確認' }
    ],
    week: [
      { id: 'C-week-1', text: '到着後1週目の家族動線確認（通学/通勤）' },
      { id: 'C-week-2', text: '医療機関・緊急先の確認' },
      { id: 'C-week-3', text: '仮住まいでの生活準備' }
    ],
    after1w: [
      { id: 'C-after1w-1', text: '学校・学区手続きの進捗確認' },
      { id: 'C-after1w-2', text: '住居入居後の生活立ち上げ（電気/水/ネット）' },
      { id: 'C-after1w-3', text: '車・保険関連の初期対応確認' }
    ]
  }
});

async function getChecklist(params) {
  const payload = params || {};
  if (!payload.lineUserId) throw new Error('lineUserId required');
  const user = await usersRepo.getUser(payload.lineUserId);
  if (!user) throw new Error('user not found');
  const scenarioKey = user.scenarioKey;
  const stepKey = user.stepKey;
  const items = (CHECKLISTS[scenarioKey] && CHECKLISTS[scenarioKey][stepKey]) ? CHECKLISTS[scenarioKey][stepKey] : [];
  return { scenarioKey, stepKey, items };
}

module.exports = {
  getChecklist
};
