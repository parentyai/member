'use strict';

const PROCEDURE_KNOWLEDGE_CATALOG = Object.freeze({
  school: {
    domainIntent: 'school',
    knowledgeMode: 'mixed',
    overallFlow: [
      '学区・対象校・開始時期の条件を確認する',
      '必要書類と予防接種・学年配置の要件を確認する',
      '登録・面談・提出日程を確定する'
    ],
    keyPoints: [
      '必要書類と予防接種要件は district と school ごとに差が出ます',
      '学年・開始希望日・住む予定エリアが決まると確認先がかなり絞れます'
    ],
    troublePoints: [
      '住むエリアが未定のままだと対象校と enrollment 条件が固まりにくいです',
      '住所証明・予防接種記録・前在籍校の記録が途中で欠けると止まりやすいです'
    ],
    goodToDo: [
      '住まい候補と school 候補を同じエリア軸で並べる',
      '住所証明、子どもの本人確認、学校記録、予防接種記録を1つのフォルダにまとめる'
    ],
    officialCheckTargets: [
      'district enrollment / registration page',
      'district immunization requirements page',
      'school registration or appointment page'
    ],
    missingFacts: [
      '住む予定の city / district',
      '子どもの学年または年齢',
      '登校を始めたい時期'
    ],
    quickReplies: [
      { label: '必要書類', text: '必要書類' },
      { label: '確認先', text: '確認先' },
      { label: '次の一手', text: '次の一手' }
    ]
  },
  housing: {
    domainIntent: 'housing',
    knowledgeMode: 'procedure_guidance',
    overallFlow: [
      '希望条件を must-have ベースで絞る',
      '候補物件ごとの申込条件と審査条件を確認する',
      '内見・申込・契約の順で進める'
    ],
    keyPoints: [
      '必要書類と審査条件は物件と管理会社ごとに差が出ます',
      '入居時期、収入証明、在留状況の組み合わせで通る候補が変わります'
    ],
    troublePoints: [
      '条件が広いままだと候補が増えすぎて内見予約まで進みにくいです',
      '申込書類の名義や日付がずれると審査が止まりやすいです'
    ],
    goodToDo: [
      'must-have を3点までに絞る',
      '本人確認、収入確認、連絡先、入居希望日の共通情報を先に揃える'
    ],
    officialCheckTargets: [
      'property listing application requirements',
      'management company requirements page',
      'local housing office page for rule-sensitive fees or disclosures'
    ],
    missingFacts: [
      '住みたいエリア',
      '入居したい時期',
      '家賃レンジ'
    ],
    quickReplies: [
      { label: '条件整理', text: '条件整理' },
      { label: '必要書類', text: '必要書類' },
      { label: '次の一手', text: '次の一手' }
    ]
  },
  ssn: {
    domainIntent: 'ssn',
    knowledgeMode: 'rule_check',
    overallFlow: [
      '申請可否と在留・就労条件を確認する',
      '必要書類と最寄り office の予約要否を確認する',
      '申請して受領まで追跡する'
    ],
    keyPoints: [
      '必要書類の組み合わせは在留区分や就労条件で変わります',
      'office ごとに予約運用や待ち方が違うので office 単位で見る必要があります'
    ],
    troublePoints: [
      '本人確認書類の名前表記や期限がずれると再訪になりやすいです',
      'office 単位の予約運用を見落とすと空振りしやすいです'
    ],
    goodToDo: [
      '本人確認と在留・就労根拠の書類を同じ一覧にして持ち出せるようにする',
      '行く office を1つ決めて予約要否と持ち物をメモする'
    ],
    officialCheckTargets: [
      'SSA eligibility guidance',
      'SSA office locator / appointment page',
      'SSA document requirements page'
    ],
    missingFacts: [
      '在留ステータスまたは就労状況',
      '行きたい office の地域',
      '急ぎで必要な理由'
    ],
    quickReplies: [
      { label: '必要書類', text: '必要書類' },
      { label: '予約要否', text: '予約要否' },
      { label: '次の一手', text: '次の一手' }
    ]
  },
  banking: {
    domainIntent: 'banking',
    knowledgeMode: 'mixed',
    overallFlow: [
      '使いたい銀行と口座種別を1つに絞る',
      '口座ごとの必要書類と住所・SSN条件を確認する',
      'オンラインか支店で申請して追加確認を終える'
    ],
    keyPoints: [
      '必要書類は bank と account type ごとに差が出ます',
      'SSN 要否や住所証明の通り方は bank ごとに運用差があります'
    ],
    troublePoints: [
      'bank と口座種別が決まっていないと必要書類が固まりません',
      '住所証明の形式が bank 側の条件に合わないと止まりやすいです'
    ],
    goodToDo: [
      '用途に合う口座種別を1つ決める',
      '本人確認、住所証明、SSN 有無、初回入金条件を1枚にまとめる'
    ],
    officialCheckTargets: [
      'bank account opening requirements page',
      'branch appointment page',
      'account disclosures or FAQ page'
    ],
    missingFacts: [
      '使いたい銀行または口座の用途',
      'SSN の有無',
      '住所証明に使えそうな書類'
    ],
    quickReplies: [
      { label: '必要書類', text: '必要書類' },
      { label: '銀行選び', text: '銀行選び' },
      { label: '次の一手', text: '次の一手' }
    ]
  },
  general: {
    domainIntent: 'general',
    knowledgeMode: 'procedure_guidance',
    overallFlow: [
      '優先する手続きを1件に絞る',
      'その手続きの期限・必要書類・予約要否を確認する',
      '今日進める一手だけ決める'
    ],
    keyPoints: [
      '同時に複数進めるより、後続への影響が大きい手続きを先に固定した方が進みやすいです'
    ],
    troublePoints: [
      '期限と確認先が曖昧なままだと候補だけ増えて前に進みにくいです'
    ],
    goodToDo: [
      '優先する1件の期限と確認先だけ先にメモする'
    ],
    officialCheckTargets: [
      '対象手続きの official page or office page'
    ],
    missingFacts: [
      'いちばん先に進めたい手続き'
    ],
    quickReplies: [
      { label: '次の一手', text: '次の一手' },
      { label: '確認先', text: '確認先' }
    ]
  }
});

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeProcedureDomain(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'bank') return 'banking';
  if (normalized && Object.prototype.hasOwnProperty.call(PROCEDURE_KNOWLEDGE_CATALOG, normalized)) return normalized;
  return 'general';
}

function resolveProcedureKnowledgeSpec(domainIntent) {
  return PROCEDURE_KNOWLEDGE_CATALOG[normalizeProcedureDomain(domainIntent)] || PROCEDURE_KNOWLEDGE_CATALOG.general;
}

module.exports = {
  PROCEDURE_KNOWLEDGE_CATALOG,
  normalizeProcedureDomain,
  resolveProcedureKnowledgeSpec
};
