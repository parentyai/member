'use strict';

const { detectMessagePosture } = require('./opportunity/detectMessagePosture');

const CONTEXT_LABEL_MAP = Object.freeze({
  school: '学校手続き',
  housing: '住まい探し',
  ssn: 'SSN手続き',
  banking: '銀行手続き',
  general: ''
});

const CASUAL_FOLLOWUP_DIRECT_ANSWER_MAP = Object.freeze({
  school: {
    docs_required: '学校手続きは、住所証明と予防接種記録を先にそろえると止まりにくいです。',
    appointment_needed: '学校登録や面談は予約制のことがあるので、対象校が決まったら予約要否を確認しましょう。',
    next_step: '次は、対象校を1校に絞って必要書類を先に確定するのが最短です。'
  },
  housing: {
    docs_required: '住居手続きは、本人確認と収入確認に使う書類を先にそろえるのが近道です。',
    appointment_needed: '内見は予約が必要な物件が多いので、候補を絞って空き枠を確認しましょう。',
    next_step: '次は、候補物件を3件まで絞ってから内見可否を確認すると進みやすいです。'
  },
  ssn: {
    docs_required: 'SSNは本人確認書類と在留資格が分かる書類を先にそろえるのが最優先です。',
    appointment_needed: '窓口は予約が必要な地域もあるので、最寄り窓口の予約要否を先に確認しましょう。',
    next_step: '次は、必要書類を1つの一覧にまとめてから窓口の予約要否を確認するのが確実です。'
  },
  banking: {
    docs_required: '口座開設は本人確認と住所証明の2点を先にそろえると進みやすいです。',
    appointment_needed: '支店手続きは予約制のことがあるので、来店前に予約可否を確認しましょう。',
    next_step: '次は、口座種別を1つ決めて必要書類を先に確定するのが最短です。'
  }
});

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeContextHintKey(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return 'general';
  if (normalized === 'school') return 'school';
  if (normalized === 'housing') return 'housing';
  if (normalized === 'ssn') return 'ssn';
  if (normalized === 'banking') return 'banking';
  return 'general';
}

function normalizeContextHintLabel(value) {
  const key = normalizeContextHintKey(value);
  if (key !== 'general') return CONTEXT_LABEL_MAP[key];
  return normalizeText(value);
}

function trimForPaidLineMessage(value) {
  const text = normalizeText(value);
  if (!text) return '';
  return text.length > 420 ? `${text.slice(0, 420)}…` : text;
}

function buildGreetingReply() {
  return 'こんにちは。今日はどの手続きから進めますか？';
}

function buildSmalltalkReply() {
  return 'ありがとうございます。必要なら、今いちばん気になっている手続きを1つだけ教えてください。';
}

function hashForVariantSeed(value) {
  const text = normalizeText(value);
  if (!text) return 0;
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickVariant(list, seedSource) {
  const rows = Array.isArray(list) ? list.filter(Boolean) : [];
  if (!rows.length) return '';
  const seed = hashForVariantSeed(seedSource);
  return rows[seed % rows.length];
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
  return overlap / Math.max(aTokens.size, bTokens.size);
}

function pickLeastRepeatedLine(list, recentHints, seedSource) {
  const rows = Array.isArray(list) ? list.filter(Boolean) : [];
  if (!rows.length) return '';
  const hints = Array.isArray(recentHints)
    ? recentHints.filter((item) => typeof item === 'string' && item.trim()).slice(0, 4)
    : [];
  if (!hints.length) return pickVariant(rows, seedSource);
  const seedIndex = hashForVariantSeed(seedSource) % rows.length;
  const scored = rows.map((line, index) => ({
    line,
    index,
    similarity: hints.reduce((max, hint) => Math.max(max, similarityScore(line, hint)), 0),
    seedDistance: Math.abs(index - seedIndex)
  }));
  scored.sort((left, right) => left.similarity - right.similarity || left.seedDistance - right.seedDistance);
  return scored[0].line;
}

function buildFollowupActionLine(followupIntent) {
  if (followupIntent === 'docs_required') return '次は、不足しやすい書類を1つずつ確認しましょう。';
  if (followupIntent === 'appointment_needed') return '次は、最寄り窓口を1つ決めて予約要否を確認しましょう。';
  if (followupIntent === 'next_step') return '次は、期限が近い手続きを1つに固定して進めましょう。';
  return '';
}

function resolveFollowupDirectAnswer(contextHint, followupIntent) {
  const domainKey = normalizeContextHintKey(contextHint);
  if (domainKey === 'general') return '';
  const normalizedIntent = normalizeText(followupIntent).toLowerCase();
  const byDomain = CASUAL_FOLLOWUP_DIRECT_ANSWER_MAP[domainKey];
  if (!byDomain) return '';
  return normalizeText(byDomain[normalizedIntent] || '');
}

function buildGeneralCasualReply(question, atoms, contextHint, followupIntent, recentResponseHints) {
  const message = normalizeText(question);
  const hints = Array.isArray(recentResponseHints) ? recentResponseHints : [];
  const contextLabel = normalizeContextHintLabel(contextHint);
  const directAnswer = resolveFollowupDirectAnswer(contextHint, followupIntent);
  if (directAnswer) {
    const actionLine = buildFollowupActionLine(followupIntent);
    return actionLine ? `${directAnswer}\n${actionLine}` : directAnswer;
  }

  const questionPrompt = atoms && typeof atoms.question === 'string' && atoms.question.trim()
    ? atoms.question.trim()
    : '';
  const promptCandidates = questionPrompt
    ? [questionPrompt]
    : (contextLabel
      ? [
        `${contextLabel}の続きとして、いま詰まっている点を1つだけ教えてください。`,
        `${contextLabel}で次に決めたいことを1つだけ教えてください。`,
        `${contextLabel}について、まず何から進めたいですか？`
      ]
      : [
        '続きで進めるため、いま一番気になっている点を1つだけ教えてください。',
        '状況を合わせたいので、次に決めたいことを1つだけ教えてください。',
        '短くで大丈夫なので、先に進めたい手続きを1つだけ教えてください。'
      ]);
  const prompt = pickLeastRepeatedLine(promptCandidates, hints, `${message}:${contextLabel}`);

  if (!message) return prompt;

  const intro = pickLeastRepeatedLine([
    '了解です。状況を短く整理しながら進めます。',
    'ありがとうございます。いまの状況を一緒に整えて進めます。',
    '把握しました。まずは迷いを減らすところから進めます。'
  ], hints, message);

  return [
    intro,
    prompt
  ].join('\n');
}

function buildContractDrivenCasualReply(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const requestContract = payload.requestContract && typeof payload.requestContract === 'object'
    ? payload.requestContract
    : {};
  const requestShape = normalizeText(requestContract.requestShape).toLowerCase();
  const outputForm = normalizeText(requestContract.outputForm).toLowerCase() || 'default';
  const contextKey = normalizeContextHintKey(payload.contextHint);
  if (!['rewrite', 'summarize', 'message_template', 'compare', 'criteria', 'correction', 'followup_continue'].includes(requestShape)) {
    return '';
  }
  const lines = [];
  if (requestShape === 'compare') {
    lines.push('短く言うと、無料はFAQ検索中心で、有料は状況整理や次の一手の提案まで対応します。');
  } else if (requestShape === 'message_template') {
    lines.push('今進める順番を整理したいので、最初に何を優先すべきか教えてもらえると助かります。');
  } else if (requestShape === 'rewrite') {
    lines.push(outputForm === 'non_dogmatic'
      ? 'もしよければ、まずは優先するものを1つだけ決める形で進めると無理が少ないです。'
      : 'まずは優先するものを1つだけ決めると、進め方がかなり楽になります。');
    if (outputForm === 'two_sentences') {
      lines.push('そのあとで、必要書類か予約要否のどちらを見るか選べば十分です。');
    }
  } else if (requestShape === 'criteria') {
    lines.push('制度・期限・必要書類・費用が変わりうる話なら、公式情報を確認する場面です。');
  } else if (requestShape === 'correction') {
    const label = CONTEXT_LABEL_MAP[contextKey] || 'その条件';
    lines.push(`${label}を優先する前提で考え直します。`);
  } else if (requestShape === 'summarize') {
    lines.push('今日は最優先の1件の期限だけ確認して、必要書類か予約要否のどちらを見るか決めましょう。');
  } else {
    lines.push('その続きなら、次の一手を1つだけ決めると進めやすいです。');
  }
  if (!lines.length) return '';
  if (outputForm === 'two_sentences') return trimForPaidLineMessage(lines.slice(0, 2).join('\n'));
  return trimForPaidLineMessage(lines[0]);
}

function generatePaidCasualReply(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const messageText = normalizeText(payload.messageText);
  const contextHint = typeof payload.contextHint === 'string' ? normalizeText(payload.contextHint) : '';
  const followupIntent = typeof payload.followupIntent === 'string' ? normalizeText(payload.followupIntent) : '';
  const recentResponseHints = Array.isArray(payload.recentResponseHints)
    ? payload.recentResponseHints.filter((item) => typeof item === 'string' && item.trim()).slice(0, 6)
    : [];
  const suggestedAtoms = payload.suggestedAtoms && typeof payload.suggestedAtoms === 'object'
    ? payload.suggestedAtoms
    : { nextActions: [], pitfall: null, question: null };
  const requestContract = payload.requestContract && typeof payload.requestContract === 'object'
    ? payload.requestContract
    : {};
  const posture = detectMessagePosture({ messageText });

  if (posture.isGreeting) {
    return {
      ok: true,
      mode: 'casual',
      replyText: trimForPaidLineMessage(buildGreetingReply())
    };
  }
  if (posture.isSmalltalk) {
    return {
      ok: true,
      mode: 'casual',
      replyText: trimForPaidLineMessage(buildSmalltalkReply())
    };
  }

  const contractReply = buildContractDrivenCasualReply({
    requestContract,
    contextHint,
    followupIntent
  });
  if (contractReply) {
    return {
      ok: true,
      mode: 'casual',
      replyText: contractReply
    };
  }

  return {
    ok: true,
    mode: 'casual',
    replyText: trimForPaidLineMessage(
      buildGeneralCasualReply(messageText, suggestedAtoms, contextHint, followupIntent, recentResponseHints)
    )
  };
}

module.exports = {
  generatePaidCasualReply
};
