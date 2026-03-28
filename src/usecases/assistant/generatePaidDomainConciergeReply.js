'use strict';

const { buildConciergeContextSnapshot } = require('./concierge/composeConciergeReply');
const { detectConversationIntentHits } = require('../../domain/llm/router/normalizeConversationIntent');
const { resolveFollowupIntent } = require('../../domain/llm/orchestrator/followupIntentResolver');

const FORBIDDEN_REPLY_PATTERN = /(FAQ候補|CityPack候補|根拠キー|score=|-\s*\[\]|関連情報です)/g;
const TASK_LABEL_MAP = Object.freeze({
  school_registration: '学校登録手続き',
  school_enrollment: '入学手続き',
  ssn_application: 'SSN申請手続き',
  housing_search: '住まい探し',
  bank_account_opening: '口座開設手続き'
});
const DOMAIN_ANCHOR_MAP = Object.freeze({
  housing: '住まい探しでは',
  school: '学校手続きでは',
  ssn: 'SSN手続きでは',
  banking: '銀行口座手続きでは',
  general: ''
});

const DOMAIN_SPECS = Object.freeze({
  housing: {
    situationLine: '住まい探しですね。',
    defaultAction: '希望条件を3つに絞る',
    pitfall: '審査に必要な書類が不足すると契約手続きが止まりやすくなります。',
    question: '希望エリアと入居時期を教えてもらえますか？',
    directAnswers: {
      docs_required: '住居契約では、本人確認と収入確認に使う書類を先にそろえるのが近道です。',
      appointment_needed: '内見は予約が必要な物件が多いので、候補を絞って先に空き枠を確認しましょう。',
      next_step: '次は、条件を1つ減らして候補物件を3件まで絞ると進みやすいです。'
    }
  },
  school: {
    situationLine: '学校手続きですね。',
    defaultAction: '学区と対象校の条件を確認する',
    pitfall: '提出書類の不足や期限超過で入学手続きが止まりやすくなります。',
    question: '学年と希望エリアを教えてもらえますか？',
    directAnswers: {
      docs_required: '学校手続きで先にそろえるのは、住所証明と予防接種記録です。',
      appointment_needed: '面談や学校登録は予約制のことが多いので、対象校が決まったら先に空き枠を確認しましょう。',
      next_step: '学校手続きの次は、対象校を1校に絞って必要書類を先に確定するのが最短です。'
    }
  },
  ssn: {
    situationLine: 'SSN手続きですね。',
    defaultAction: '申請条件と本人確認書類を確認する',
    pitfall: '本人確認書類の不備があると再訪が必要になりやすくなります。',
    question: 'いまの在留ステータスを教えてもらえますか？',
    directAnswers: {
      docs_required: 'SSNは本人確認書類と在留資格が分かる書類を先にそろえるのが最優先です。',
      appointment_needed: '窓口は予約が必要な地域もあるので、最寄り窓口の予約要否を先に確認しましょう。',
      next_step: '次は、必要書類を1つの一覧にまとめてから窓口の予約要否を確認するのが確実です。'
    }
  },
  banking: {
    situationLine: '銀行口座まわりですね。',
    defaultAction: '口座種別を1つ決める',
    pitfall: '住所証明の条件が合わないと口座開設が遅れやすくなります。',
    question: '使いたい銀行か用途を教えてもらえますか？',
    directAnswers: {
      docs_required: '口座開設は本人確認と住所証明の2点を先にそろえると早いです。',
      appointment_needed: '支店手続きは予約制のことがあるので、来店前に予約可否を確認してください。',
      next_step: '次は、口座種別を1つ決めて必要書類を先に確定するのが最短です。'
    }
  },
  general: {
    situationLine: 'いまの状況を整理します。',
    defaultAction: '今すぐ進める手続きを1つ決める',
    pitfall: '優先順位が曖昧だと手続きが分散しやすくなります。',
    question: 'いま一番困っている手続きを1つだけ教えてください。',
    directAnswers: {
      docs_required: '必要書類は、まず最優先の手続きに必要なものだけ先に整理すると進めやすいです。',
      appointment_needed: '予約要否は手続きごとに違うので、最優先手続きの窓口だけ先に確認しましょう。',
      next_step: '次は、最優先手続きを1つ決めて期限を確認するのが最短です。'
    }
  }
});

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeForSimilarity(value) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, ' ');
}

function similarityScore(left, right) {
  const a = normalizeForSimilarity(left);
  const b = normalizeForSimilarity(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.92;
  const aTokens = new Set(a.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  const bTokens = new Set(b.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  if (!aTokens.size || !bTokens.size) return 0;
  let overlap = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) overlap += 1;
  });
  const denominator = Math.max(aTokens.size, bTokens.size);
  return denominator > 0 ? overlap / denominator : 0;
}

function trimForLineMessage(value) {
  const text = normalizeText(value);
  if (!text) return '';
  return text.length > 420 ? `${text.slice(0, 420)}…` : text;
}

function sanitizeReplyLine(value) {
  return normalizeText(value)
    .replace(FORBIDDEN_REPLY_PATTERN, '')
    .replace(/。{2,}/g, '。')
    .replace(/？{2,}/g, '？')
    .replace(/！{2,}/g, '！')
    .replace(/。([？！])/g, '$1')
    .replace(/([？！])。/g, '$1');
}

function normalizeActions(value, limit) {
  const rows = Array.isArray(value) ? value : [];
  const max = Number.isFinite(Number(limit)) ? Math.max(1, Math.floor(Number(limit))) : 3;
  const out = [];
  rows.forEach((item) => {
    const normalized = sanitizeReplyLine(item);
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out.slice(0, max);
}

function formatTaskLabel(task) {
  if (!task || typeof task !== 'object') return '';
  const key = normalizeText(task.key || task.title || task.id);
  if (!key) return '';
  const mapped = TASK_LABEL_MAP[key.toLowerCase()];
  if (mapped) return mapped;
  return key.replace(/_/g, ' ');
}

function resolveDomainIntent(value, fallback) {
  const intent = normalizeText(value).toLowerCase();
  const fallbackIntent = normalizeText(fallback).toLowerCase();
  if (intent && intent !== 'general' && Object.prototype.hasOwnProperty.call(DOMAIN_SPECS, intent)) return intent;
  if (fallbackIntent && fallbackIntent !== 'general' && Object.prototype.hasOwnProperty.call(DOMAIN_SPECS, fallbackIntent)) {
    return fallbackIntent;
  }
  if (intent && Object.prototype.hasOwnProperty.call(DOMAIN_SPECS, intent)) return intent;
  return 'general';
}

function buildContextActions(context) {
  const source = context && typeof context === 'object' ? context : {};
  const nextActions = [];
  if (source.blockedTask) {
    const label = formatTaskLabel(source.blockedTask);
    if (label) nextActions.push(`${label}の詰まり要因を1つ特定する`);
  }
  if (source.dueSoonTask) {
    const label = formatTaskLabel(source.dueSoonTask);
    if (label) nextActions.push(`${label}の期限と窓口を確認する`);
  }
  if (Array.isArray(source.topTasks)) {
    source.topTasks.forEach((task) => {
      const label = formatTaskLabel(task);
      if (!label) return;
      nextActions.push(`${label}の条件を整理する`);
    });
  }
  return nextActions;
}

function buildFollowupQuestion(domainIntent, context) {
  const spec = DOMAIN_SPECS[domainIntent] || DOMAIN_SPECS.general;
  const phase = normalizeText(context && context.phase).toLowerCase();
  if (domainIntent === 'housing' && phase === 'return') {
    return '帰任時期を教えてもらえますか？';
  }
  return spec.question;
}

function normalizeReasonKeys(value, domainIntent) {
  const rows = Array.isArray(value) ? value : [];
  const out = [];
  rows.forEach((item) => {
    const normalized = normalizeText(item).toLowerCase().replace(/\s+/g, '_');
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  const domainReason = `${domainIntent}_intent`;
  if (!out.includes(domainReason) && domainIntent !== 'general') out.push(domainReason);
  return out.slice(0, 8);
}

function ensureSentence(value) {
  const line = sanitizeReplyLine(value);
  if (!line) return '';
  if (/[。！？!?]$/.test(line)) return line;
  return `${line}。`;
}

function hasDetailObligation(requestContract, key) {
  const obligations = requestContract && Array.isArray(requestContract.detailObligations)
    ? requestContract.detailObligations
    : [];
  return obligations.includes(key);
}

function softenLine(value) {
  const line = ensureSentence(value);
  if (!line) return '';
  if (/もしよければ|差し支えなければ|よさそう|無理が少ない|かもしれません|助かります|してみます/.test(line)) return line;
  const trimmed = line.replace(/[。！？!?]+$/g, '');
  if (/(いただけますか|もらえますか|お願いできますか|よろしいでしょうか)$/.test(trimmed)) {
    const converted = trimmed
      .replace(/教えていただけますか$/u, '教えていただけると助かります')
      .replace(/教えてもらえますか$/u, '教えてもらえると助かります')
      .replace(/確認いただけますか$/u, '確認いただけると助かります')
      .replace(/確認していただけますか$/u, '確認していただけると助かります')
      .replace(/お願いできますか$/u, 'お願いできると助かります');
    if (converted !== trimmed) {
      return ensureSentence(converted);
    }
    return line;
  }
  return ensureSentence(`もしよければ、${line.replace(/[。！？!?]+$/g, '')}と無理が少ないです`);
}

function applyContractOutputForm(lines, requestContract) {
  const shaped = (Array.isArray(lines) ? lines : [])
    .map((line) => ensureSentence(line))
    .filter(Boolean);
  if (!shaped.length) return [];
  const outputForm = normalizeText(requestContract && requestContract.outputForm).toLowerCase() || 'default';
  if (outputForm === 'non_dogmatic') {
    return [softenLine(shaped[0])];
  }
  if (outputForm === 'softer') {
    return [ensureSentence(shaped[0])];
  }
  if (outputForm === 'criteria_only') {
    return shaped.slice(0, 2);
  }
  if (outputForm === 'message_only' || outputForm === 'polite_template') {
    return [ensureSentence(shaped[0])];
  }
  if (outputForm === 'one_line') {
    const compact = shaped
      .slice(0, 2)
      .map((line) => line.replace(/[。！？!?]+$/g, ''))
      .join('、');
    return [ensureSentence(compact)];
  }
  if (outputForm === 'two_sentences') {
    return shaped.slice(0, 2);
  }
  return shaped.slice(0, 3);
}

function extractSourceLines(sourceReplyText) {
  return normalizeText(sourceReplyText)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractFirstSourceLine(sourceReplyText) {
  const lines = extractSourceLines(sourceReplyText);
  return lines[0] || '';
}

function extractSecondSourceLine(sourceReplyText) {
  const lines = extractSourceLines(sourceReplyText);
  return lines[1] || '';
}

function isRegionSpecificSourceReply(sourceReplyText) {
  return /対象地域|地域差|制度名が分かるなら|地域で差が出る話/.test(normalizeText(sourceReplyText));
}

function buildMessageTemplateFromSource(sourceReplyText, domainIntent) {
  const sourceLine = extractFirstSourceLine(sourceReplyText);
  if (/優先順位の固定と期限の見える化/.test(sourceLine)) {
    return '今は優先順位と期限を先に整理すると、進めやすそうだよ';
  }
  if (/事前予約が必要かどうか/.test(sourceLine)) {
    return 'もし差し支えなければ、事前予約が必要かどうか教えていただけると助かります';
  }
  if (isRegionSpecificSourceReply(sourceReplyText)) {
    return '地域差がありそうなので、対象地域の窓口と受付期限だけ先に確認してみます';
  }
  if (/今日は最優先の1件の期限だけ確認して/.test(sourceLine)) {
    return '今日は最優先の1件の期限だけ確認して、必要書類か予約要否のどちらを先に見るか決めてみます';
  }
  if (/制度や期限|公式情報/.test(normalizeText(sourceReplyText))) {
    return '制度や期限が変わりそうなところだけ、先に公式情報を見ておきます';
  }
  if (/今進める順番を整理したいので/.test(sourceLine)) {
    return '今進める順番を整理したいので、最初に何を優先すべきか教えてもらえると助かります';
  }
  if (/今日は/.test(sourceLine)) {
    return sourceLine.replace(/しましょう|決めましょう/g, 'してみます').replace(/ください/g, 'もらえると助かります');
  }
  if (/住まい優先|希望エリア|入居時期/.test(sourceLine) || domainIntent === 'housing') {
    return '住まい優先で進めたいので、まずは希望エリアと入居時期を整理してみます';
  }
  if (/学校優先|学区|対象校/.test(sourceLine) || domainIntent === 'school') {
    return '学校優先で進めたいので、まずは学区と対象校の条件を確認してみます';
  }
  if (/SSN|ソーシャルセキュリティ/.test(sourceLine) || domainIntent === 'ssn') {
    return 'まずはSSNを先に進めると、そのあとが整理しやすくなりそうだよ';
  }
  if (/制度・期限・必要書類・費用/.test(sourceLine)) {
    return '制度や期限が変わりうる部分は、公式窓口で確認してみます';
  }
  if (sourceLine) {
    return sourceLine
      .replace(/^もしよければ、?/u, '')
      .replace(/^よければ、?/u, '')
      .replace(/教えてもらえると助かります。?$/u, '確認してみます')
      .replace(/教えていただけると助かります。?$/u, '確認してみます')
      .replace(/一緒に整理していきましょう。?$/u, '整理してみます')
      .replace(/決めましょう。?$/u, '決めてみます')
      .replace(/進めましょう。?$/u, '進めてみます')
      .replace(/してください。?$/u, 'してみます');
  }
  return '今は優先する1件を先に決めると、進めやすそうです';
}

function buildNonDogmaticRewriteFromSource(sourceReplyText, domainIntent) {
  const sourceLine = extractFirstSourceLine(sourceReplyText);
  if (/優先順位.*期限/.test(sourceLine) || /優先順位の固定と期限の見える化/.test(sourceLine)) {
    return '今は優先順位と期限を先に整理すると、進めやすそうです';
  }
  if (/事前予約が必要かどうか/.test(sourceLine)) {
    return 'もし差し支えなければ、事前予約が必要かどうか教えていただけると助かります';
  }
  if (/今進める順番を整理したいので/.test(sourceLine)) {
    return 'もしよければ、今進める順番を整理したいので、最初に何を優先すべきか教えていただけると助かります';
  }
  if (isRegionSpecificSourceReply(sourceReplyText)) {
    return '地域差がありそうなら、対象地域の窓口と受付期限だけ見ておくと安心かもしれません';
  }
  if (/制度・期限・必要書類・費用/.test(sourceLine)) {
    return '制度や期限が変わりそうな話なら、まず公式情報を見ておくと安心かもしれません';
  }
  if (/制度や期限|公式情報/.test(normalizeText(sourceReplyText))) {
    return '制度や期限が変わりそうな話なら、まず公式情報を見ておくと安心かもしれません';
  }
  if (/その続きなら、?今日はその1件の期限を書き込むところまで進めれば十分です/.test(sourceLine)) {
    return 'もしよければ、今日はその1件の期限を書き込むところまでで十分かもしれません';
  }
  if (/今日は/.test(sourceLine)) {
    return '今日はひとまず、最優先の1件の期限だけ確認してみる形でもよさそうです';
  }
  if (/住まい|学校|SSN|銀行/.test(sourceLine)) {
    return softenLine(sourceLine);
  }
  if (sourceLine) {
    return ensureSentence(
      sourceLine
        .replace(/だよ[。！？!?]*$/u, 'です')
        .replace(/だね[。！？!?]*$/u, 'ですね')
        .replace(/しましょう[。！？!?]*$/u, 'してみてもよさそうです')
    );
  }
  return 'もしよければ、まずは優先するものを1つだけ決める形で進めると無理が少なそうです';
}

function buildConversationalRewriteFromSource(sourceReplyText) {
  const sourceLine = extractFirstSourceLine(sourceReplyText);
  const secondSourceLine = extractSecondSourceLine(sourceReplyText);
  if (/優先順位.*期限/.test(sourceLine) || /優先順位の固定と期限の見える化/.test(sourceLine)) {
    return [
      '今は、優先順位と期限を先に整理するところからで大丈夫です',
      '順番と締切が見えるだけでも、次の一手を決めやすくなります'
    ];
  }
  if (isRegionSpecificSourceReply(sourceReplyText)) {
    return [
      '地域で差が出る話は、まず窓口と必要書類、受付期限だけ見れば大丈夫です',
      '制度名が分かれば、その3点だけでもかなり判断しやすくなります'
    ];
  }
  if (/制度・期限・必要書類・費用/.test(sourceLine)) {
    return [
      '制度や期限が変わる話は、まず公式窓口や受付期限を見ておくと安心です',
      '必要書類まで見えてくると、どこを確認すべきかかなり判断しやすくなります'
    ];
  }
  if (/いまの状況を整理します|優先する手続きを1つ|いま一番困っている/.test(normalizeText(sourceReplyText))) {
    return [
      'まずは、いちばん気になっている手続きを1つに絞るところからで大丈夫です',
      'そこが決まれば、次に見ることを一緒に整理できます'
    ];
  }
  if (/その続きなら、?今日はその1件の期限を書き込むところまで進めれば十分です/.test(sourceLine)) {
    return [
      '今日は、その1件の期限を書き込むところまでで十分だと思います',
      'そこで止めても、次に再開しやすい形はちゃんと残ります'
    ];
  }
  if (/今日は/.test(sourceLine)) {
    return [
      '今日は、最優先の1件だけ見れば十分だと思います',
      '残りは今週に回す前提で大丈夫です'
    ];
  }
  if (sourceLine) {
    const softenedSecondLine = secondSourceLine
      ? ensureSentence(
        secondSourceLine
          .replace(/だよ[。！？!?]*$/u, 'です')
          .replace(/だね[。！？!?]*$/u, 'ですね')
          .replace(/[。！？!?]+$/u, '')
      )
      : '';
    return [
      sourceLine
        .replace(/だよ[。！？!?]*$/u, 'です')
        .replace(/だね[。！？!?]*$/u, 'ですね')
        .replace(/[。！？!?]+$/u, ''),
      softenedSecondLine || 'この流れが見えるだけでも、次に進む順番を決めやすくなります'
    ];
  }
  return [
    'まずは、優先するものを1つだけ決めると進めやすくなります',
    'そのあとで、必要書類か予約要否のどちらを見るか選べば十分です'
  ];
}

function buildLessBureaucraticRewriteFromSource(sourceReplyText, domainIntent) {
  const sourceLine = extractFirstSourceLine(sourceReplyText);
  if (/優先順位の固定と期限の見える化/.test(sourceLine)) {
    return '今は優先順位と期限を先に整理するところから始めると、進めやすいと思います';
  }
  if (/事前予約が必要かどうか/.test(sourceLine)) {
    return 'よければ、事前予約が必要かどうかだけ教えていただけると助かります';
  }
  if (/今進める順番を整理したいので/.test(sourceLine)) {
    return 'よければ、今進める順番を整理したいので、最初に何を優先するとよさそうか教えてもらえると助かります';
  }
  if (isRegionSpecificSourceReply(sourceReplyText)) {
    return '地域差がありそうなら、公式窓口と受付期限だけ先に見ておけると安心です';
  }
  if (/制度や期限|公式情報|確認ポイント/.test(normalizeText(sourceReplyText))) {
    return '制度や期限が動きそうなところだけ、先に公式情報を見ておけると安心です';
  }
  if (/制度・期限・必要書類・費用/.test(sourceLine)) {
    return '制度や期限が変わりそうなところだけ、先に公式情報で見ておけると安心です';
  }
  if (/その続きなら、?今日はその1件の期限を書き込むところまで進めれば十分です/.test(sourceLine)) {
    return 'よければ、今日はその1件の期限を書き込むところまでで十分だと思います';
  }
  if (/住まい|学校|SSN|銀行/.test(sourceLine) || domainIntent !== 'general') {
    return `よければ、${buildMessageTemplateFromSource(sourceReplyText, domainIntent).replace(/[。！？!?]+$/g, '')}。`;
  }
  if (sourceLine) {
    return ensureSentence(
      sourceLine
        .replace(/だよ[。！？!?]*$/u, 'です')
        .replace(/だね[。！？!?]*$/u, 'ですね')
        .replace(/教えてもらえると助かります[。！？!?]*$/u, '確認してみます')
    );
  }
  return 'よければ、まずは優先するものを1つだけ決めて、順番を一緒に整理していきましょう';
}

function buildEchoContinuationFromSource(sourceReplyText) {
  const source = normalizeText(sourceReplyText);
  if (!source) return [];
  if (/住まい・学校・SSN|生活基盤|後回しできる手続き/.test(source)) {
    return [
      'その続きなら、まず住むエリアと学区の条件が両立する候補を1つに絞り、SSNは必要書類だけ先にまとめると進めやすいです'
    ];
  }
  if (/住むエリアと学区|住所証明など共通で使う書類|住居候補と学校候補/.test(source)) {
    return [
      'その続きなら、まず住所証明など共通で使う書類を先にまとめ、そのあと住居候補と学校候補を同じエリア軸で絞ると進めやすいです'
    ];
  }
  if (/優先順位の固定と期限の見える化/.test(source)) {
    return [
      'その続きなら、最優先の1件に期限を書き込むところから始めると進めやすいです'
    ];
  }
  if (/先にSSNを進めるのが無難です|本人確認や就労まわり/.test(source)) {
    return [
      'その続きなら、まずSSNの必要書類と窓口要件だけ先に確認すると判断しやすいです'
    ];
  }
  if (/対象地域の窓口、必要書類、受付期限|制度・期限・必要書類・費用|公式窓口/.test(source)) {
    return [
      'その続きなら、まず対象地域の公式窓口ページで必要書類と受付期限だけ確認すると進めやすいです'
    ];
  }
  if (/今日は最優先の1件の期限だけ確認/.test(source)) {
    return [
      'その続きなら、今日はその1件の期限を書き込むところまで進めれば十分です'
    ];
  }
  return [];
}

function buildDeepenReplyFromSource(sourceReplyText, domainIntent, messageText) {
  const source = normalizeText(sourceReplyText);
  const sourceLine = extractFirstSourceLine(sourceReplyText);
  const normalizedMessage = normalizeText(messageText);
  if (!source) return [];
  if (/優先順位.*期限/.test(sourceLine) || /進め方がかなり安定/.test(source)) {
    return [
      '具体的には、いま抱えている手続きを一覧にして、期限があるものから先に印を付けるところまでで十分です',
      'そのあとで、今日動く1件だけ決めると、無理なく進めやすくなります'
    ];
  }
  if (/対象地域の窓口|必要書類|受付期限/.test(source) || /確認するのは/.test(sourceLine)) {
    if (domainIntent === 'school') {
      return [
        '具体的には、教育窓口のページで対象校の条件、必要書類、受付期限の3点だけ見れば十分です',
        'この3点が見えると、次に問い合わせる内容までかなり具体化できます'
      ];
    }
    return [
      '具体的には、窓口名、必要書類、受付期限の3点だけ見れば十分です'
    ];
  }
  if (/住むエリアと学区の関係/.test(source) || /住居候補と学校候補/.test(source)) {
    return [
      '具体的には、住む候補エリアを1つ決めて、そのエリアに対応する学区と学校候補を同じ表で並べると判断しやすいです',
      'そのあとで、住所証明など共通で使う書類を先にまとめると二度手間が減ります'
    ];
  }
  if (/先にSSNを進める/.test(source) || /SSN/.test(sourceLine)) {
    return [
      '具体的には、まず本人確認書類と在留情報の2点がそろうかを確認して、次に窓口の予約要否を見れば十分です',
      '口座開設を急ぐ事情があるときだけ、SSN不要で進められる条件を並行確認する形が安全です'
    ];
  }
  if (/今日は/.test(sourceLine) || /最優先の1件/.test(sourceLine)) {
    return [
      '具体的には、今日はその1件の期限を書き出して、必要書類か予約要否のどちらを先に確認するか決めるところまでで十分です',
      'そこで止まっても、次に再開しやすい形が残ります'
    ];
  }
  if (/どうやって|具体的には|何を見ればいい/.test(normalizedMessage)) {
    return [
      withDomainAnchor('具体的には、いまの回答で出てきた条件を1つに絞って、その条件に必要な情報だけを先に確認すると進めやすいです', domainIntent),
      withDomainAnchor('確認する順番は、期限、必要書類、予約要否の順で十分です', domainIntent)
    ];
  }
  return [
    withDomainAnchor('具体的には、直前の案内で出てきた条件を1つに絞って確認すると進めやすいです', domainIntent),
    withDomainAnchor('そのあとで、必要書類か予約要否のどちらを先に見るか決めれば十分です', domainIntent)
  ];
}

function buildNextStepProposalFromSource(sourceReplyText, domainIntent) {
  const source = normalizeText(sourceReplyText);
  const sourceLine = extractFirstSourceLine(sourceReplyText);
  if (/対象地域の窓口|必要書類|受付期限/.test(source) || /確認するのは/.test(sourceLine)) {
    return 'まずは対象地域の窓口ページで、必要書類と受付期限だけ見ておくと次に動きやすそうです';
  }
  if (/優先順位.*期限/.test(sourceLine) || /進め方がかなり安定/.test(source)) {
    return 'まずは優先順位と期限を書き出して、今日動く1件だけ決めてみると進めやすそうです';
  }
  const echoContinuationLines = buildEchoContinuationFromSource(sourceReplyText);
  if (echoContinuationLines.length > 0) {
    return softenLine(echoContinuationLines[0]);
  }
  if (sourceLine) {
    return softenLine(sourceLine);
  }
  return withDomainAnchor('まずは次の一手を1つだけ決めてみると進めやすそうです', domainIntent);
}

function buildCityScopedAnswerLines(requestContract, domainIntent) {
  const contract = requestContract && typeof requestContract === 'object' ? requestContract : {};
  const locationHint = contract.locationHint && typeof contract.locationHint === 'object'
    ? contract.locationHint
    : {};
  const kind = normalizeText(locationHint.kind).toLowerCase();
  if (domainIntent === 'school' && (kind === 'city' || kind === 'regionkey')) {
    return [
      '都市が分かっているなら、まず現地の教育窓口で対象校の条件、必要書類、受付期限の3点だけ確認すると進めやすいです',
      'その3点が見えると、次に何を優先するかかなり決めやすくなります'
    ];
  }
  if (domainIntent === 'school' && kind === 'state') {
    return [
      '州だけ分かっている段階なら、まず対象の市区ごとの教育窓口、必要書類、受付期限の3点を確認すると進めやすいです',
      '市区が決まると、次の一手をかなり具体化できます'
    ];
  }
  return [];
}

function buildContractReply(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const messageText = normalizeText(payload.messageText);
  const requestContract = payload.requestContract && typeof payload.requestContract === 'object'
    ? payload.requestContract
    : {};
  const requestShape = normalizeText(requestContract.requestShape).toLowerCase() || 'answer';
  const depthIntent = normalizeText(requestContract.depthIntent).toLowerCase() || 'answer';
  const outputForm = normalizeText(requestContract.outputForm).toLowerCase() || 'default';
  const knowledgeScope = normalizeText(requestContract.knowledgeScope).toLowerCase() || 'none';
  const locationHint = requestContract.locationHint && typeof requestContract.locationHint === 'object'
    ? requestContract.locationHint
    : {};
  const locationHintKind = normalizeText(locationHint.kind).toLowerCase();
  const domainIntent = resolveDomainIntent(requestContract.primaryDomainIntent || payload.domainIntent, payload.contextResumeDomain);
  const followupIntent = normalizeText(payload.followupIntent).toLowerCase();
  const domainSignals = Array.isArray(requestContract.domainSignals) ? requestContract.domainSignals : [];
  const sourceReplyText = normalizeText(requestContract.sourceReplyText || payload.sourceReplyText);
  const lines = [];

  if (followupIntent === 'docs_required' && domainIntent === 'school' && /(必要|書類|しょるい|提出物)/.test(messageText)) {
    lines.push('学校手続きで先にそろえるのは、住所証明と予防接種記録です');
  } else if (depthIntent === 'deepen' && sourceReplyText) {
    lines.push(...buildDeepenReplyFromSource(sourceReplyText, domainIntent, messageText));
  } else if (requestShape === 'followup_continue' && sourceReplyText) {
    if (/(次の一手だけ|次の一手を|次に何を)/i.test(messageText)) {
      lines.push(buildNextStepProposalFromSource(sourceReplyText, domainIntent));
    } else {
      const echoContinuationLines = buildEchoContinuationFromSource(sourceReplyText);
      const followupLine = payload.followupIntent
        ? resolveFollowupDirectAnswer({
          followupIntent: payload.followupIntent,
          domainIntent,
          repeatedFollowupStreak: payload.repeatedFollowupStreak || 0,
          directAnswers: (DOMAIN_SPECS[domainIntent] || DOMAIN_SPECS.general).directAnswers || {}
        })
        : '';
      lines.push(...(echoContinuationLines.length
        ? echoContinuationLines
        : [followupLine || withDomainAnchor('その続きなら、次の一手を1つだけ決めると進めやすいです', domainIntent)]));
    }
  } else if (requestShape === 'answer' && ['city', 'regionkey', 'state'].includes(locationHintKind)) {
    lines.push(...buildCityScopedAnswerLines(requestContract, domainIntent));
  } else if (requestShape === 'compare') {
    if (/(無料プラン|有料プラン|プランの違い|プラン比較)/i.test(messageText)) {
      lines.push('短く言うと、無料はFAQ検索中心で、有料は状況整理や次の一手の提案まで対応します');
      lines.push('有料なら、抜け漏れ確認や順序整理まで一緒に進められます');
    } else if (domainSignals.includes('ssn') && domainSignals.includes('banking')) {
      lines.push('先にSSNを進めるのが無難です');
      lines.push('理由は、本人確認や後続手続きの判断材料として使いやすいからです');
      lines.push('ただし口座開設を急ぐなら、SSN不要で進められる条件だけ先に確認しましょう');
    } else {
      lines.push('比べる軸は、期限の近さ、後続への影響、今日動けるかの3つです');
      lines.push('この順で見ると、優先順位を決めやすくなります');
    }
  } else if (requestShape === 'correction') {
    if (domainSignals.includes('housing') && domainSignals.includes('school')) {
      if (domainIntent === 'housing') {
        lines.push('了解です。住まい優先で見るなら、希望エリアと入居時期を先に固定しましょう');
        lines.push('次に、内見候補を3件までに絞って必要書類を確認すると進めやすいです');
      } else {
        lines.push('了解です。学校優先で見るなら、学区と対象校の条件を先に確認しましょう');
        lines.push('次に、住所証明や予防接種記録など必要書類をまとめると進めやすいです');
      }
    } else if (outputForm === 'message_only') {
      lines.push(buildMessageTemplateFromSource(sourceReplyText, domainIntent));
    } else {
      lines.push(withDomainAnchor('了解です。前提を修正して、その条件で考え直します', domainIntent));
      lines.push(withDomainAnchor('次は優先する1件だけ固定して進めると整理しやすいです', domainIntent));
    }
  } else if (requestShape === 'message_template') {
    if (/(予約が必要かどうか).*(失礼なく|短文)|失礼なく聞く短文|短文を1つ作って/i.test(messageText)) {
      lines.push('ご都合のよい範囲で、事前予約が必要かどうか教えていただけますか');
    } else if (/(家族に送れる一文|家族に送れる|一文にして)/i.test(messageText)) {
      lines.push(sourceReplyText ? buildMessageTemplateFromSource(sourceReplyText, domainIntent) : 'まずは最優先の1件だけ決めて、順番に進めれば大丈夫そうだよ');
    } else {
      lines.push(buildMessageTemplateFromSource(sourceReplyText, domainIntent));
    }
  } else if (requestShape === 'rewrite') {
    if (outputForm === 'two_sentences') {
      lines.push(...buildConversationalRewriteFromSource(sourceReplyText));
    } else if (outputForm === 'non_dogmatic') {
      if (/(次の一手だけ|次の一手を|次に何を)/i.test(messageText) && sourceReplyText) {
        lines.push(buildNextStepProposalFromSource(sourceReplyText, domainIntent));
      } else {
        lines.push(buildNonDogmaticRewriteFromSource(sourceReplyText, domainIntent));
      }
    } else if (outputForm === 'softer' || /(事務的すぎない|事務的じゃない)/i.test(messageText)) {
      lines.push(buildLessBureaucraticRewriteFromSource(sourceReplyText, domainIntent));
    } else {
      if (/(疲れて|かなり疲れ).*(言い換える|言い方|どう言い換える)/i.test(messageText)
        && /今日はその1件の期限を書き込むところまで/.test(sourceReplyText)) {
        lines.push('疲れている前提なら、今日はその1件の期限を書き込むところまでで十分です');
        lines.push('残りは今週に回す前提で、そこで止めて大丈夫です');
      } else {
        lines.push('疲れている前提なら、今日は1件だけ決めて期限だけ確認すれば十分です');
        lines.push('残りは今週に回す前提で、いまは最優先の1件だけ進めましょう');
      }
    }
  } else if (requestShape === 'criteria') {
    if (/(地域によって違う|地域差がある|何を確認すべきかだけ)/i.test(messageText)) {
      lines.push('確認するのは、対象地域の窓口、必要書類、受付期限の3点です');
      lines.push('制度名が分かるなら、その3点だけ見れば判断しやすくなります');
    } else {
      lines.push('制度・期限・必要書類・費用が変わりうる話なら、公式情報を確認する場面です');
      lines.push('特に申請可否や法的条件に触れるときは、案内より先に公式窓口で最終確認してください');
    }
  } else if (requestShape === 'summarize') {
    if (/(今日.*今週.*今月|今日・今週・今月|今週・今月)/i.test(messageText)) {
      lines.push('今日: 期限だけ確認する');
      lines.push('今週: 最優先の1件を動かす');
      lines.push('今月: 残りを順番に整える');
    } else if (/(足りていない|足りない|不足|抜け漏れ|抜け|漏れ)/i.test(messageText)) {
      if (/(2つ|二つ|2点|二点)/i.test(messageText)) {
        lines.push('足りていないのは、優先順位の固定と期限の見える化です');
      } else {
        lines.push('足りていないのは、優先順位の固定、期限の見える化、次の一手の1件化です');
      }
    } else {
      lines.push('今日は最優先の1件の期限だけ確認して、必要書類か予約要否のどちらを見るか決めましょう');
    }
  }

  if (!lines.length) return null;
  const shapedLines = applyContractOutputForm(lines, requestContract);
  const replyText = trimForLineMessage(shapedLines.join('\n'));
  return {
    replyText,
    preserveReplyText: true,
    atoms: {
      situationLine: shapedLines[0] || '',
      nextActions: shapedLines.slice(1),
      pitfall: '',
      followupQuestion: ''
    }
  };
}

function buildActionLine(action) {
  const normalized = sanitizeReplyLine(action);
  if (!normalized) return '';
  if (/^(次|まず|先に)/.test(normalized)) return ensureSentence(normalized);
  return ensureSentence(`次は${normalized}`);
}

function pickLeastRepeatedLine(lines, hints) {
  const variants = Array.isArray(lines) ? lines.filter(Boolean) : [];
  if (!variants.length) return '';
  const normalizedHints = Array.isArray(hints)
    ? hints.filter((item) => typeof item === 'string' && item.trim()).slice(0, 4)
    : [];
  if (!normalizedHints.length) return variants[0];
  const scored = variants.map((line, index) => ({
    index,
    line,
    similarity: normalizedHints.reduce((max, hint) => Math.max(max, similarityScore(line, hint)), 0)
  }));
  scored.sort((left, right) => left.similarity - right.similarity || left.index - right.index);
  return scored[0].line;
}

function hasDomainWord(line, domainIntent) {
  const text = normalizeText(line);
  if (!text) return false;
  if (domainIntent === 'school') return /(学校|学区|入学)/.test(text);
  if (domainIntent === 'ssn') return /(SSN|ソーシャルセキュリティ)/i.test(text);
  if (domainIntent === 'housing') return /(住まい|物件|賃貸|住宅|内見)/.test(text);
  if (domainIntent === 'banking') return /(銀行|口座|支店)/.test(text);
  return true;
}

function resolveDomainAnchor(domainIntent) {
  const key = resolveDomainIntent(domainIntent);
  return DOMAIN_ANCHOR_MAP[key] || '';
}

function withDomainAnchor(line, domainIntent) {
  const base = normalizeText(line);
  if (!base || resolveDomainIntent(domainIntent) === 'general' || hasDomainWord(base, domainIntent)) return base;
  const anchor = resolveDomainAnchor(domainIntent);
  if (!anchor) return base;
  const normalizedBase = base.replace(/^[、,\s]+/, '');
  return `${anchor}、${normalizedBase}`;
}

function resolveFollowupActionVariants(followupIntent, domainIntent) {
  const key = normalizeText(followupIntent).toLowerCase();
  const domain = resolveDomainIntent(domainIntent);
  if (!key) return [];
  const common = {
    docs_required: [
      '次は不足しやすい書類を1つずつ確認しましょう。',
      '次は提出先ごとの必要書類を先に分けて整理しましょう。'
    ],
    appointment_needed: [
      '次は最寄り窓口を1つ決めて予約可否を確認しましょう。',
      '次は対象窓口を1つに絞って予約要否を先に確定しましょう。'
    ],
    next_step: [
      '次は期限が近い手続きを1つに固定して進めましょう。',
      '次は最優先手続きを1つだけ決めて進めましょう。'
    ]
  };
  const byDomain = {
    school: {
      docs_required: '次は学校の提出書類を先にそろえましょう。',
      appointment_needed: '次は対象校の面談予約が必要か確認しましょう。',
      next_step: '次は対象校を1校に絞って手続きを進めましょう。'
    },
    ssn: {
      docs_required: '次はSSN申請で不足しやすい書類を先に確認しましょう。',
      appointment_needed: '次はSSN窓口の予約要否を先に確認しましょう。',
      next_step: '次はSSN申請の優先手順を1つに絞って進めましょう。'
    },
    housing: {
      docs_required: '次は住居契約に必要な書類を先に確認しましょう。',
      appointment_needed: '次は内見予約の空き枠を先に確認しましょう。',
      next_step: '次は候補物件を3件まで絞って進めましょう。'
    },
    banking: {
      docs_required: '次は口座開設の本人確認書類を先に確認しましょう。',
      appointment_needed: '次は来店予約の要否を先に確認しましょう。',
      next_step: '次は口座種別を1つ決めて進めましょう。'
    }
  };
  const preferred = byDomain[domain] && byDomain[domain][key] ? [byDomain[domain][key]] : [];
  return preferred.concat(common[key] || []);
}

function selectVariantByStreak(variants, streak) {
  const rows = Array.isArray(variants) ? variants.filter(Boolean) : [];
  if (!rows.length) return '';
  const index = Math.min(rows.length - 1, Math.max(0, streak));
  return rows[index] || rows[0];
}

function resolveFollowupDirectAnswer(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const followupIntent = normalizeText(payload.followupIntent).toLowerCase();
  const domainIntent = resolveDomainIntent(payload.domainIntent);
  const streak = Number.isFinite(Number(payload.repeatedFollowupStreak))
    ? Math.max(0, Math.floor(Number(payload.repeatedFollowupStreak)))
    : 0;
  const directAnswers = payload.directAnswers && typeof payload.directAnswers === 'object' ? payload.directAnswers : {};
  const directAnswer = directAnswers[followupIntent] || '';
  if (!directAnswer) return '';

  if (streak <= 0) return withDomainAnchor(directAnswer, domainIntent);

  const repeatedAnswerByIntent = {
    docs_required: [
      '同じ書類確認なら、次は不足しやすい書類を1つずつ潰すのが最短です。',
      '書類確認を続けるなら、最優先手続きの提出物だけ先に確定するのが早いです。'
    ],
    appointment_needed: [
      '予約の確認を続けるなら、最寄り窓口を1つ決めて予約可否を確定しましょう。',
      '予約要否の確認は、対象窓口を1つ固定して可否を先に確認するのが確実です。'
    ],
    next_step: [
      '同じ話題を進めるなら、期限が近い手続きを1つに固定すると進みます。',
      '次の一手を進めるなら、まず期限の近い手続きを1つだけ確定しましょう。'
    ]
  };
  const repeatedVariant = selectVariantByStreak(repeatedAnswerByIntent[followupIntent], streak - 1);
  return withDomainAnchor(repeatedVariant || directAnswer, domainIntent);
}

function countFollowupIntentStreak(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const followupIntent = normalizeText(payload.followupIntent).toLowerCase();
  const rows = Array.isArray(payload.recentFollowupIntents) ? payload.recentFollowupIntents : [];
  if (!followupIntent) return 0;
  let streak = 0;
  rows.slice(0, 3).forEach((item) => {
    const normalized = normalizeText(item).toLowerCase();
    if (normalized && normalized === followupIntent) streak += 1;
  });
  return streak;
}

function resolveFollowupIntentForDomain(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const explicit = normalizeText(payload.followupIntent).toLowerCase();
  if (explicit === 'docs_required' || explicit === 'appointment_needed' || explicit === 'next_step') {
    return explicit;
  }
  const decision = resolveFollowupIntent({
    messageText: payload.messageText,
    domainIntent: payload.domainIntent,
    contextResumeDomain: payload.contextResumeDomain,
    recentFollowupIntents: payload.recentFollowupIntents
  });
  return decision && typeof decision.followupIntent === 'string' ? decision.followupIntent : null;
}

function buildPresetReply(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const lines = [payload.primaryLine, payload.secondaryLine, payload.tertiaryLine]
    .map((line) => ensureSentence(line))
    .filter(Boolean)
    .slice(0, 3);
  const replyText = trimForLineMessage(lines.join('\n'));
  return {
    replyText,
    preserveReplyText: payload.preserveReplyText !== false,
    atoms: {
      situationLine: lines[0] || '',
      nextActions: lines.slice(1),
      pitfall: '',
      followupQuestion: ''
    }
  };
}

function resolvePresetReply(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const messageText = normalizeText(payload.messageText);
  if (!messageText) return null;
  const conversationHits = detectConversationIntentHits(messageText);

  if (/(無料プラン|有料プラン|プランの違い|プラン.*違い|プラン比較|subscription|plan)/i.test(messageText)) {
    return buildPresetReply({
      primaryLine: '短く言うと、無料はFAQ検索中心で、有料は状況整理や次の一手の提案まで対応します',
      secondaryLine: 'このアカウントが有料なら、状況整理・抜け漏れ確認・順序整理・次アクション提案を使える前提です'
    });
  }

  if (
    /(赴任|引っ越し|引越し|移住|生活セットアップ|生活立ち上げ).*(何から始め|最初にやるべき|最初に何|順番|ざっくり)/i.test(messageText)
    && !(conversationHits.housing === true && conversationHits.school === true)
  ) {
    return buildPresetReply({
      primaryLine: '最初に見る順番は、期限がある手続き、生活基盤、後回しできる手続きです',
      secondaryLine: 'まずは住まい・学校・SSNなど、後続に影響するものを1つだけ先に固定しましょう',
      tertiaryLine: 'そのうえで、必要書類と予約要否を同じ一覧にまとめると進めやすいです'
    });
  }

  if (conversationHits.housing === true && conversationHits.school === true && /(何から|順番|確認|不安|手続き)/i.test(messageText)) {
    return buildPresetReply({
      primaryLine: '順番は、住むエリアと学区の関係を先に確認することです',
      secondaryLine: '次に、住所証明など共通で使う書類をまとめます',
      tertiaryLine: 'そのうえで、住居候補と学校候補を同じエリア軸で絞り込みましょう',
      preserveReplyText: true
    });
  }

  if (/((ssn).*(銀行|口座)|(銀行|口座).*(ssn))/i.test(messageText) && /(先に|どっち|どちら|優先|理由)/i.test(messageText)) {
    return buildPresetReply({
      primaryLine: '先にSSNを進めるのが無難です',
      secondaryLine: '理由は、本人確認や就労まわりの手続きとつながりやすく、後続の判断材料になりやすいからです',
      tertiaryLine: 'ただし口座開設を急ぐ事情があるなら、SSN不要で進められる条件だけ先に確認しましょう'
    });
  }

  if (/(優先すべき|優先順位).*(3つ|三つ)|3つだけ教えて/i.test(messageText)) {
    return buildPresetReply({
      primaryLine: '優先する3つは、期限が近いこと、後続に影響すること、今日すぐ動かせることです',
      secondaryLine: 'この順で並べると、同時進行で散りにくくなります'
    });
  }

  if (/最初の(5分|10分)/i.test(messageText)) {
    return buildPresetReply({
      primaryLine: /10分/i.test(messageText)
        ? '最初の10分は、いちばん詰まっている手続きを1つだけ決めて、期限と窓口、必要書類をメモしてください'
        : '最初の5分は、いちばん詰まっている手続きを1つだけ決めて、期限と窓口をメモしてください',
      secondaryLine: 'そのあと必要書類か予約要否のどちらを先に確認するか決めれば十分です'
    });
  }

  if (/(疲れて|かなり疲れ).*(言い換える|言い方|どう言い換える)/i.test(messageText)) {
    return buildPresetReply({
      primaryLine: '疲れている前提なら、今日は1件だけ決めて期限だけ確認すれば十分です',
      secondaryLine: '残りは今週に回す前提で、いまは最優先の1件だけ進めましょう'
    });
  }

  if (/(今日.*今週.*今月|今日・今週・今月|今週・今月)/i.test(messageText) && /(短く|順|並べて)/i.test(messageText)) {
    return buildPresetReply({
      primaryLine: '今日: 期限だけ確認する',
      secondaryLine: '今週: 最優先の1件を動かす',
      tertiaryLine: '今月: 残りを順番に整える'
    });
  }

  if (/(止めること.*進めること|進めること.*止めること)/i.test(messageText)) {
    return buildPresetReply({
      primaryLine: '止めること: 同時進行を増やすこと',
      secondaryLine: '進めること: いちばん詰まっている1件の期限を確認する',
      tertiaryLine: 'その次に、その1件の次の一手を1つだけ決める'
    });
  }

  if (/(足りていない|足りない|不足|抜け漏れ|抜け|漏れ).*((3つ|三つ|3点|3つまで)|(2つ|二つ|2点|二点))/i.test(messageText)) {
    return buildPresetReply({
      primaryLine: /(2つ|二つ|2点|二点)/i.test(messageText)
        ? '足りていないのは、優先順位の固定と期限の見える化です'
        : '足りていないのは、優先順位の固定、期限の見える化、次の一手の1件化です',
      secondaryLine: /(2つ|二つ|2点|二点)/i.test(messageText)
        ? 'この2つが決まると、進め方がかなり安定します'
        : 'この3つが決まると、進め方がかなり安定します'
    });
  }

  if (/(家族に送れる一文|家族に送れる|一文にして)/i.test(messageText)) {
    return buildPresetReply({
      primaryLine: 'まずは最優先の1件だけ決めて、順番に進めれば大丈夫そうだよ'
    });
  }

  if (/(相手に送る文面だけ|文面だけ)/i.test(messageText)) {
    return buildPresetReply({
      primaryLine: '今進める順番を整理したいので、最初に何を優先すべきか教えてもらえると助かります'
    });
  }

  if (/(今日やること.*1行|今日やること.*一行|1行にして|一行にして)/i.test(messageText)) {
    return buildPresetReply({
      primaryLine: '今日は最優先の1件の期限だけ確認して、必要書類か予約要否のどちらを先に見るか決めましょう'
    });
  }

  if (/(断定しすぎない|断定.*言い方に直して|言い方に直して)/i.test(messageText)) {
    return buildPresetReply({
      primaryLine: 'もしよければ、まずは優先するものを1つだけ決める形で進めると無理が少なそうです'
    });
  }

  if (/(人に話す感じ|2文にして|二文にして)/i.test(messageText)) {
    return buildPresetReply({
      primaryLine: '制度や期限が変わる話は、まず公式情報を見ておくと安心です',
      secondaryLine: '必要なら、そのあとで確認ポイントを一緒に絞れます'
    });
  }

  if (/(事務的すぎない|やさしくしたいんじゃなくて.*事務的すぎない|事務的じゃない)/i.test(messageText)) {
    return buildPresetReply({
      primaryLine: 'よければ、まずは優先するものを1つだけ決めて、順番を一緒に整理していきましょう'
    });
  }

  if (/((学校じゃなくて|学校ではなく|学校より).*(住まい|住居|住宅|引っ越し|家探し|部屋探し))|(住まい優先で考え直して)/i.test(messageText)) {
    return buildPresetReply({
      primaryLine: '了解です。住まい優先で見るなら、希望エリアと入居時期を先に固定しましょう',
      secondaryLine: '次に、内見候補を3件までに絞って必要書類を確認すると進めやすいです'
    });
  }

  if (/(((住まい|住居|住宅|引っ越し|家探し|部屋探し).*(じゃなくて|ではなく|より).*(学校|学区|入学|転校))|(学校優先で考え直して|学校優先))/i.test(messageText)) {
    return buildPresetReply({
      primaryLine: '了解です。学校優先で見るなら、学区と対象校の条件を先に確認しましょう',
      secondaryLine: '次に、住所証明や予防接種記録など必要書類をまとめると進めやすいです'
    });
  }

  if (/(不安が強い前提|不安が強い).*(1つだけ|一つだけ|絞って)/i.test(messageText)) {
    return buildPresetReply({
      primaryLine: '不安が強いときは、今日は最優先の1件の期限だけ確認すれば十分です'
    });
  }

  if (/(公式情報を確認すべき場面|公式情報.*判断基準|判断基準だけ教えて)/i.test(messageText)) {
    return buildPresetReply({
      primaryLine: '制度・期限・必要書類・費用が変わりうる話なら、公式情報を確認する場面です',
      secondaryLine: '特に申請可否や法的条件に触れるときは、案内より先に公式窓口で最終確認してください'
    });
  }

  if (/(地域によって違う|地域差がある|何を確認すべきかだけ)/i.test(messageText)) {
    return buildPresetReply({
      primaryLine: '確認するのは、対象地域の窓口、必要書類、受付期限の3点です',
      secondaryLine: '制度名が分かるなら、その3点だけ見れば判断しやすくなります'
    });
  }

  if (/(予約が必要かどうか).*(失礼なく|短文)|失礼なく聞く短文|短文を1つ作って/i.test(messageText)) {
    return buildPresetReply({
      primaryLine: 'ご都合のよい範囲で、事前予約が必要かどうか教えていただけますか'
    });
  }

  if (/(ここまでの会話を踏まえて).*(断定せずに提案|やわらかく提案)|断定せずに提案|やわらかく提案/i.test(messageText)) {
    return buildPresetReply({
      primaryLine: '次の一手としては、いちばん後続に影響する手続きを1件だけ先に決めるのがよさそうです',
      secondaryLine: 'そのあとで、必要書類か予約要否のどちらを先に確認するか選ぶ進め方が無理が少ないです'
    });
  }

  return null;
}

function buildConciseReply(parts) {
  const payload = parts && typeof parts === 'object' ? parts : {};
  const domainIntent = resolveDomainIntent(payload.domainIntent, payload.contextResumeDomain);
  const requestContract = payload.requestContract && typeof payload.requestContract === 'object'
    ? payload.requestContract
    : {};
  const spec = DOMAIN_SPECS[domainIntent] || DOMAIN_SPECS.general;
  const followupIntent = payload.followupIntent || null;
  const repeatedFollowupStreak = Number.isFinite(Number(payload.repeatedFollowupStreak))
    ? Math.max(0, Math.floor(Number(payload.repeatedFollowupStreak)))
    : 0;
  const repeatedFollowupIntent = repeatedFollowupStreak >= 1;
  const recentResponseHints = Array.isArray(payload.recentResponseHints) ? payload.recentResponseHints : [];
  const directAnswers = spec.directAnswers && typeof spec.directAnswers === 'object' ? spec.directAnswers : {};
  const followupActionVariants = resolveFollowupActionVariants(followupIntent, domainIntent);
  const recoveryLeadLine = payload.recoverySignal === true ? '了解です。前提を修正して続けます。' : '';
  const contractReply = buildContractReply({
    messageText: payload.messageText,
    domainIntent,
    contextResumeDomain: payload.contextResumeDomain,
    requestContract,
    followupIntent,
    repeatedFollowupStreak
  });
  if (contractReply) return contractReply;
  const presetReply = resolvePresetReply({
    messageText: payload.messageText
  });
  if (presetReply) return presetReply;
  let resolvedPrimaryLine = followupIntent
    ? resolveFollowupDirectAnswer({
      followupIntent,
      domainIntent,
      repeatedFollowupStreak,
      directAnswers
    })
    : (payload.situationLine || spec.situationLine);
  resolvedPrimaryLine = withDomainAnchor(resolvedPrimaryLine, domainIntent);
  const primaryLineCandidate = recoveryLeadLine
    ? `${recoveryLeadLine} ${resolvedPrimaryLine || payload.situationLine || spec.situationLine}`
    : resolvedPrimaryLine;
  const primaryLine = ensureSentence(
    pickLeastRepeatedLine([primaryLineCandidate, payload.situationLine, spec.situationLine], recentResponseHints)
      || resolvedPrimaryLine
      || payload.situationLine
      || spec.situationLine
  );
  const actions = normalizeActions(payload.nextActions, 3);
  const followupActionLine = followupIntent
    ? ensureSentence(selectVariantByStreak(followupActionVariants, repeatedFollowupStreak))
    : '';
  const actionLine = followupActionLine || buildActionLine(actions[0] || spec.defaultAction);
  const pitfall = ensureSentence(`詰まりやすいのは ${sanitizeReplyLine(payload.pitfall) || spec.pitfall}`);
  const question = sanitizeReplyLine(payload.followupQuestion);
  const avoidQuestionBack = hasDetailObligation(requestContract, 'avoid_question_back');
  const questionLine = question
    ? (/[?？]$/.test(question) ? question : `${question}？`)
    : '';

  const lines = [primaryLine];
  if (followupIntent) {
    if (actionLine && actionLine !== primaryLine) lines.push(actionLine);
    if (repeatedFollowupIntent && questionLine && avoidQuestionBack !== true) lines.push(questionLine);
  } else {
    if (actionLine && actionLine !== primaryLine) lines.push(actionLine);
    if (questionLine && avoidQuestionBack !== true) {
      lines.push(questionLine);
    } else if (pitfall) {
      lines.push(pitfall);
    }
  }
  const shapedLines = applyContractOutputForm(lines.filter(Boolean), requestContract);
  const lineLimit = followupIntent ? 2 : 3;
  const replyText = trimForLineMessage((shapedLines.length ? shapedLines : lines.filter(Boolean)).slice(0, lineLimit).join('\n'));
  return {
    replyText,
    preserveReplyText: requestContract.outputForm && requestContract.outputForm !== 'default',
    atoms: {
      situationLine: shapedLines[0] || primaryLine,
      nextActions: actionLine && actionLine !== primaryLine ? [actionLine] : [],
      pitfall: questionLine && avoidQuestionBack !== true ? '' : pitfall,
      followupQuestion: avoidQuestionBack === true ? '' : (questionLine || '')
    }
  };
}

function buildDomainAuditMeta(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const blockedReason = normalizeText(payload.blockedReason);
  const blockedReasons = blockedReason ? [blockedReason] : [];
  return {
    topic: payload.domainIntent || 'general',
    mode: 'B',
    userTier: 'paid',
    citationRanks: [],
    urlCount: 0,
    urls: [],
    guardDecisions: [],
    blockedReasons,
    injectionFindings: false,
    evidenceNeed: 'none',
    evidenceOutcome: blockedReasons.length ? 'BLOCKED' : 'SUPPORTED',
    chosenAction: null,
    contextVersion: 'concierge_ctx_v1',
    featureHash: null,
    postRenderLint: { findings: [], modified: false },
    contextSignature: null,
    contextualBanditEnabled: false,
    contextualFeatures: null,
    counterfactualSelectedArmId: null,
    counterfactualSelectedRank: null,
    counterfactualTopArms: [],
    counterfactualEval: null
  };
}

function generatePaidDomainConciergeReply(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const domainIntent = resolveDomainIntent(payload.domainIntent, payload.contextResumeDomain);
  const spec = DOMAIN_SPECS[domainIntent] || DOMAIN_SPECS.general;
  const contextSnapshot = payload.contextSnapshot && typeof payload.contextSnapshot === 'object'
    ? payload.contextSnapshot
    : null;
  const conciergeContext = buildConciergeContextSnapshot(contextSnapshot);
  const decision = payload.opportunityDecision && typeof payload.opportunityDecision === 'object'
    ? payload.opportunityDecision
    : null;
  const followupIntent = resolveFollowupIntentForDomain({
    followupIntent: payload.followupIntent,
    messageText: payload.messageText,
    domainIntent,
    contextResumeDomain: payload.contextResumeDomain,
    recentFollowupIntents: payload.recentFollowupIntents
  });
  const repeatedFollowupStreak = countFollowupIntentStreak({
    followupIntent,
    recentFollowupIntents: payload.recentFollowupIntents
  });

  const suggestedAtoms = decision && decision.suggestedAtoms && typeof decision.suggestedAtoms === 'object'
    ? decision.suggestedAtoms
    : {};
  const mergedActions = normalizeActions([]
    .concat(Array.isArray(suggestedAtoms.nextActions) ? suggestedAtoms.nextActions : [])
    .concat(buildContextActions(conciergeContext))
    .concat(spec.defaultAction), 3);
  const reasonKeys = normalizeReasonKeys(
    decision && Array.isArray(decision.opportunityReasonKeys) ? decision.opportunityReasonKeys : [],
    domainIntent
  );

  const concise = buildConciseReply({
    messageText: payload.messageText,
    domainIntent,
    contextResumeDomain: payload.contextResumeDomain,
    situationLine: spec.situationLine,
    nextActions: mergedActions,
    pitfall: suggestedAtoms.pitfall || spec.pitfall,
    followupQuestion: suggestedAtoms.question || buildFollowupQuestion(domainIntent, conciergeContext),
    followupIntent,
    repeatedFollowupStreak,
    recentResponseHints: payload.recentResponseHints,
    recoverySignal: payload.recoverySignal === true,
    requestContract: payload.requestContract
  });

  return {
    ok: true,
    domainIntent,
    conversationMode: 'concierge',
    opportunityType: decision && typeof decision.opportunityType === 'string' && decision.opportunityType.trim()
      ? decision.opportunityType
      : 'action',
    opportunityReasonKeys: reasonKeys,
    interventionBudget: 1,
    followupIntent,
    conciseModeApplied: true,
    preserveReplyText: concise.preserveReplyText === true,
    replyText: concise.replyText,
    atoms: concise.atoms,
    auditMeta: buildDomainAuditMeta({
      domainIntent,
      blockedReason: payload.blockedReason || null
    })
  };
}

module.exports = {
  generatePaidDomainConciergeReply,
  FORBIDDEN_REPLY_PATTERN,
  buildMessageTemplateFromSource,
  buildNonDogmaticRewriteFromSource,
  buildConversationalRewriteFromSource,
  buildLessBureaucraticRewriteFromSource,
  buildEchoContinuationFromSource,
  buildDeepenReplyFromSource,
  buildCityScopedAnswerLines,
  buildNextStepProposalFromSource
};
