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
      docs_required: '学校手続きは、住所証明と予防接種記録を先にそろえると止まりにくいです。',
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
    .replace(/！{2,}/g, '！');
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

  if (/最初の5分/i.test(messageText)) {
    return buildPresetReply({
      primaryLine: '最初の5分は、いちばん詰まっている手続きを1つだけ決めて、期限と窓口をメモしてください',
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

  if (/(足りていない|足りない|不足|抜け漏れ|抜け|漏れ).*(3つ|三つ|3点|3つまで)/i.test(messageText)) {
    return buildPresetReply({
      primaryLine: '足りていないのは、優先順位の固定、期限の見える化、次の一手の1件化です',
      secondaryLine: 'この3つが決まると、進め方がかなり安定します'
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

  if (/(ここまでの会話を踏まえて).*(断定せずに提案)|断定せずに提案/i.test(messageText)) {
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
  const questionLine = question
    ? (/[?？]$/.test(question) ? question : `${question}？`)
    : '';

  const lines = [primaryLine];
  if (followupIntent) {
    if (actionLine && actionLine !== primaryLine) lines.push(actionLine);
    if (repeatedFollowupIntent && questionLine) lines.push(questionLine);
  } else {
    if (actionLine && actionLine !== primaryLine) lines.push(actionLine);
    if (questionLine) {
      lines.push(questionLine);
    } else if (pitfall) {
      lines.push(pitfall);
    }
  }
  const lineLimit = followupIntent ? 2 : 3;
  const replyText = trimForLineMessage(lines.filter(Boolean).slice(0, lineLimit).join('\n'));
  return {
    replyText,
    atoms: {
      situationLine: primaryLine,
      nextActions: actionLine && actionLine !== primaryLine ? [actionLine] : [],
      pitfall: questionLine ? '' : pitfall,
      followupQuestion: questionLine || ''
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
    recoverySignal: payload.recoverySignal === true
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
  FORBIDDEN_REPLY_PATTERN
};
