'use strict';

const {
  normalizeProcedureDomain,
  resolveProcedureKnowledgeSpec
} = require('./procedureKnowledgeCatalog');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function sanitizeSentence(value) {
  const text = normalizeText(value)
    .replace(/\s+/g, ' ')
    .replace(/。{2,}/g, '。')
    .replace(/？{2,}/g, '？')
    .replace(/！{2,}/g, '！');
  if (!text) return '';
  return /[。！？!?]$/.test(text) ? text : `${text}。`;
}

function uniqueStrings(values, limit) {
  const rows = Array.isArray(values) ? values : [];
  const out = [];
  rows.forEach((value) => {
    const normalized = sanitizeSentence(value);
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return Number.isFinite(Number(limit)) ? out.slice(0, Math.max(0, Math.floor(Number(limit)))) : out;
}

function uniqueRawStrings(values, limit) {
  const rows = Array.isArray(values) ? values : [];
  const out = [];
  rows.forEach((value) => {
    const normalized = normalizeText(value);
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return Number.isFinite(Number(limit)) ? out.slice(0, Math.max(0, Math.floor(Number(limit)))) : out;
}

function normalizeEvidenceRef(ref, fallbackId) {
  if (typeof ref === 'string') {
    const label = normalizeText(ref);
    if (!label) return null;
    return {
      ref_id: fallbackId,
      label,
      source_snapshot_id: null,
      authority_tier: 'UNKNOWN',
      freshness_status: 'unknown',
      readiness_decision: 'unknown',
      disclosure_required: false,
      url: null
    };
  }
  const payload = ref && typeof ref === 'object' ? ref : {};
  const label = normalizeText(payload.label || payload.title || payload.text || payload.articleId || payload.sourceId);
  if (!label) return null;
  return {
    ref_id: normalizeText(payload.ref_id || payload.refId || payload.articleId || payload.sourceId || fallbackId) || fallbackId,
    label,
    source_snapshot_id: normalizeText(payload.source_snapshot_id || payload.sourceSnapshotId || payload.sourceId) || null,
    authority_tier: normalizeText(payload.authority_tier || payload.authorityTier || payload.sourceType || 'UNKNOWN').toUpperCase() || 'UNKNOWN',
    freshness_status: normalizeText(payload.freshness_status || payload.freshnessStatus || 'unknown').toLowerCase() || 'unknown',
    readiness_decision: normalizeText(payload.readiness_decision || payload.readinessDecision || 'unknown').toLowerCase() || 'unknown',
    disclosure_required: payload.disclosure_required === true || payload.disclosureRequired === true,
    url: normalizeText(payload.url) || null,
    source_type: normalizeText(payload.source_type || payload.sourceType).toLowerCase() || null,
    region_scope: normalizeText(payload.region_scope || payload.regionScope || payload.regionKey).toLowerCase() || null,
    domain: normalizeText(payload.domain || payload.domainIntent).toLowerCase() || null,
    source_notes: normalizeText(payload.source_notes || payload.sourceNotes || payload.reason) || null,
    procedure_key: normalizeText(payload.procedure_key || payload.procedureKey).toLowerCase() || null,
    applies_when: normalizeText(payload.applies_when || payload.appliesWhen) || null,
    trust_notes: normalizeText(payload.trust_notes || payload.trustNotes) || null,
    corroboration_count: Number.isFinite(Number(payload.corroboration_count || payload.corroborationCount))
      ? Math.max(0, Math.min(20, Math.floor(Number(payload.corroboration_count || payload.corroborationCount))))
      : null,
    stale_handling: normalizeText(payload.stale_handling || payload.staleHandling).toLowerCase() || null
  };
}

function collectEvidenceRefs(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const refs = [];
  const addRef = (ref) => {
    const normalized = normalizeEvidenceRef(ref, `evidence_${refs.length + 1}`);
    if (!normalized) return;
    const duplicate = refs.some((item) => item.ref_id === normalized.ref_id || item.label === normalized.label);
    if (!duplicate) refs.push(normalized);
  };
  (Array.isArray(payload.faqCandidates) ? payload.faqCandidates : []).slice(0, 2).forEach((candidate) => {
    addRef({
      ref_id: candidate.articleId,
      label: candidate.title || candidate.articleId,
      sourceSnapshotId: candidate.articleId,
      authorityTier: 'T2_PUBLIC_DATA',
      readinessDecision: 'allow',
      sourceType: 'community',
      sourceNotes: 'saved FAQ / curated knowledge article',
      corroborationCount: 1
    });
  });
  (Array.isArray(payload.cityPackCandidates) ? payload.cityPackCandidates : []).slice(0, 2).forEach((candidate) => {
    addRef({
      ref_id: candidate.sourceId,
      label: candidate.title || candidate.sourceId,
      sourceSnapshotId: candidate.sourceId,
      authorityTier: 'T2_PUBLIC_DATA',
      readinessDecision: 'allow',
      sourceType: 'semi_official',
      regionScope: normalizeText(candidate.regionKey || candidate.cityKey || candidate.state).toLowerCase() || null,
      sourceNotes: normalizeText(candidate.reason) || 'city pack candidate',
      corroborationCount: 1
    });
  });
  (Array.isArray(payload.supportingSourceRefs) ? payload.supportingSourceRefs : []).slice(0, 4).forEach((ref) => addRef(ref));
  return refs.slice(0, 6);
}

function inferSourceTypeFromAuthority(authorityTier) {
  const normalized = normalizeText(authorityTier).toUpperCase();
  if (normalized.startsWith('T1')) return 'official';
  if (normalized.startsWith('T2')) return 'semi_official';
  if (normalized.startsWith('T4')) return 'community';
  return 'other';
}

function resolveRegionScopeFromLocationHint(locationHint) {
  const payload = locationHint && typeof locationHint === 'object' ? locationHint : {};
  return normalizeText(payload.regionKey || payload.cityKey || payload.state).toLowerCase() || 'general';
}

function buildRawSourceLayer(supportingSourceRefs, domainIntent, locationHint) {
  const refs = Array.isArray(supportingSourceRefs) ? supportingSourceRefs : [];
  const fallbackRegionScope = resolveRegionScopeFromLocationHint(locationHint);
  const layer = [];
  refs.forEach((ref) => {
    const sourceType = normalizeText(ref && ref.source_type).toLowerCase() || inferSourceTypeFromAuthority(ref && ref.authority_tier);
    const row = {
      refId: normalizeText(ref && ref.ref_id) || normalizeText(ref && ref.source_snapshot_id) || null,
      label: normalizeText(ref && ref.label) || null,
      url: normalizeText(ref && ref.url) || null,
      freshnessStatus: normalizeText(ref && ref.freshness_status).toLowerCase() || 'unknown',
      authorityTier: normalizeText(ref && ref.authority_tier).toUpperCase() || 'UNKNOWN',
      sourceType,
      regionScope: normalizeText(ref && ref.region_scope).toLowerCase() || fallbackRegionScope,
      domain: normalizeText(ref && ref.domain).toLowerCase() || normalizeProcedureDomain(domainIntent),
      sourceNotes: normalizeText(ref && ref.source_notes) || null,
      trustNotes: normalizeText(ref && ref.trust_notes) || null,
      procedureKey: normalizeText(ref && ref.procedure_key).toLowerCase() || null,
      appliesWhen: normalizeText(ref && ref.applies_when) || null,
      corroborationCount: Number.isFinite(Number(ref && ref.corroboration_count))
        ? Math.max(0, Math.min(20, Math.floor(Number(ref.corroboration_count))))
        : 0,
      staleHandling: normalizeText(ref && ref.stale_handling).toLowerCase() || 'check_before_use'
    };
    if (!row.refId && !row.label) return;
    if (layer.some((item) => item.refId && row.refId && item.refId === row.refId)) return;
    layer.push(row);
  });
  return layer.slice(0, 6);
}

function buildProcedureKnowledgeLayer(rawSourceLayer, domainSpec, params) {
  const payload = params && typeof params === 'object' ? params : {};
  const sources = Array.isArray(rawSourceLayer) ? rawSourceLayer : [];
  const domainIntent = normalizeProcedureDomain(payload.domainIntent);
  const messageText = normalizeText(payload.messageText);
  const primarySource = sources[0] || null;
  const sourceMix = sources.reduce((acc, row) => {
    const key = normalizeText(row && row.sourceType).toLowerCase() || 'other';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const appliesWhen = normalizeText(primarySource && primarySource.appliesWhen)
    || (messageText ? sanitizeSentence(messageText).replace(/[。！？!?]+$/g, '') : `${domainIntent} の手続きを進めるとき`);
  const confidenceBasis = sources.some((row) => row.sourceType === 'community')
    ? 'community/blog を含む raw source を手続き知識へ正規化し、official check target と併用'
    : 'available sources を手続き知識へ正規化し、official check target を優先';
  return [{
    procedureKey: normalizeText(primarySource && primarySource.procedureKey).toLowerCase() || `${domainIntent}_procedure`,
    regionScope: normalizeText(primarySource && primarySource.regionScope).toLowerCase() || resolveRegionScopeFromLocationHint(payload.locationHint),
    appliesWhen,
    overallFlow: uniqueStrings(domainSpec.overallFlow, 3),
    stepSummary: uniqueStrings(domainSpec.overallFlow, 3),
    keyPoints: uniqueStrings(domainSpec.keyPoints, 2),
    troublePoints: uniqueStrings(domainSpec.troublePoints, 2),
    goodToDo: uniqueStrings(domainSpec.goodToDo, 2),
    officialCheckTargets: uniqueRawStrings(domainSpec.officialCheckTargets, 3),
    confidenceBasis,
    supportingSourceRefs: sources.map((row) => row.refId || row.label).filter(Boolean).slice(0, 6),
    sourceMix
  }];
}

function buildRawSourceReview(rawSourceLayer) {
  const rows = Array.isArray(rawSourceLayer) ? rawSourceLayer : [];
  const countByType = rows.reduce((acc, row) => {
    const key = normalizeText(row && row.sourceType).toLowerCase() || 'other';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return {
    rawSourceCount: rows.length,
    officialSourceCount: countByType.official || 0,
    semiOfficialSourceCount: countByType.semi_official || 0,
    communitySourceCount: countByType.community || 0,
    otherSourceCount: countByType.other || 0
  };
}

function buildProcedureKnowledgeReview(procedureKnowledgeLayer) {
  const rows = Array.isArray(procedureKnowledgeLayer) ? procedureKnowledgeLayer : [];
  return {
    entryCount: rows.length,
    procedureKeys: rows.map((row) => normalizeText(row && row.procedureKey).toLowerCase()).filter(Boolean).slice(0, 4),
    regionScopes: rows.map((row) => normalizeText(row && row.regionScope).toLowerCase()).filter(Boolean).slice(0, 4)
  };
}

function resolveKnowledgeMode(messageText, followupIntent, domainSpec) {
  const normalizedMessage = normalizeText(messageText).toLowerCase();
  const normalizedFollowupIntent = normalizeText(followupIntent).toLowerCase();
  if (normalizedFollowupIntent === 'docs_required' || normalizedFollowupIntent === 'appointment_needed') return 'rule_check';
  if (normalizedFollowupIntent === 'next_step') return 'procedure_guidance';
  if (/(期限|必要書類|書類|予約|予防接種|要件)/.test(normalizedMessage)) return 'rule_check';
  if (/(何から|流れ|手順|順番|どうやって|全体工程|ざっくり|途中編入|進め方)/.test(normalizedMessage)) {
    return 'procedure_guidance';
  }
  return domainSpec.knowledgeMode || 'mixed';
}

function resolveProcedureComplexity(messageText, followupIntent, requestContract) {
  const normalizedMessage = normalizeText(messageText);
  const outputForm = normalizeText(requestContract && requestContract.outputForm).toLowerCase();
  if (outputForm === 'one_line') return 'compressed';
  if (outputForm === 'two_sentences') return 'short';
  if (followupIntent && normalizedMessage.length <= 16) return 'compressed';
  if (/(流れ|手順|順番|全体工程|ざっくり|途中編入|何から|どうやって)/.test(normalizedMessage)) return 'full';
  if (normalizedMessage.length >= 28) return 'short';
  return 'compressed';
}

function resolveReplyObjective(knowledgeMode, requestContract, packet) {
  const requestShape = normalizeText(requestContract && requestContract.requestShape).toLowerCase();
  if (requestShape === 'rewrite' || requestShape === 'message_template') return 'transform_only';
  if (packet.decisionCriticalMissingFacts.length > 0 && !packet.locationKnown && knowledgeMode === 'rule_check') {
    return 'clarify_blocker';
  }
  if (knowledgeMode === 'procedure_guidance' || knowledgeMode === 'mixed') return 'decide_next_step';
  return 'answer_now';
}

function resolveLocationKnown(locationHint) {
  const payload = locationHint && typeof locationHint === 'object' ? locationHint : {};
  return Boolean(normalizeText(payload.cityKey) || normalizeText(payload.regionKey) || normalizeText(payload.state));
}

function resolveOfficialCheckTargets(domainSpec, locationKnown, knowledgeMode) {
  const targets = uniqueRawStrings(domainSpec.officialCheckTargets, 3);
  if (targets.length === 0) return [];
  if (locationKnown) return targets;
  if (knowledgeMode === 'rule_check') return targets.slice(0, 2);
  return targets.slice(0, 1);
}

function resolveDirectAnswer(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const domainIntent = normalizeProcedureDomain(payload.domainIntent);
  const followupIntent = normalizeText(payload.followupIntent).toLowerCase();
  const locationKnown = payload.locationKnown === true;
  const messageText = normalizeText(payload.messageText);

  if (followupIntent === 'docs_required') {
    if (domainIntent === 'school') {
      return locationKnown
        ? '必要書類は school ごとに差があるので、まず対象校か district の enrollment / registration ページにある一覧を確認するのが確実です。'
        : '必要書類は district ごとに差があるので、まず住む予定の city / district を1つ仮置きして enrollment / registration ページの一覧を確認するのが確実です。';
    }
    if (domainIntent === 'housing') return '必要書類は物件ごとに差があるので、まず申込予定の listing か管理会社の application requirements を確認するのが確実です。';
    if (domainIntent === 'ssn') return '必要書類は在留・就労条件で変わるので、まず SSA の document requirements と自分の status に合う組み合わせを確認するのが確実です。';
    if (domainIntent === 'banking') return '必要書類は bank と口座種別で変わるので、まず候補 bank の account opening requirements を確認するのが確実です。';
  }

  if (followupIntent === 'appointment_needed') {
    if (domainIntent === 'school') return '予約要否は district enrollment office か対象校の registration / appointment 案内で確認できます。';
    if (domainIntent === 'housing') return '内見予約要否は listing の内見枠か管理会社・broker の案内で確認できます。';
    if (domainIntent === 'ssn') return '予約要否は行く office ごとに違うので、SSA office locator と office 案内を確認するのが確実です。';
    if (domainIntent === 'banking') return '来店予約要否は bank の branch appointment page か口座開設案内で確認できます。';
  }

  if (followupIntent === 'next_step') {
    if (domainIntent === 'school') {
      return locationKnown
        ? 'いまやる一手は、対象校か district を1つ決めて enrollment / registration ページの必要書類と受付スケジュールを見ることです。'
        : 'いまやる一手は、住む予定の city / district を1つ仮置きして教育窓口の enrollment ページを開くことです。';
    }
    if (domainIntent === 'housing') return 'いまやる一手は、must-have 条件を3つに絞って候補物件を3件まで減らすことです。';
    if (domainIntent === 'ssn') return 'いまやる一手は、行く SSA office を1つ決めて document requirements と予約要否を確認することです。';
    if (domainIntent === 'banking') return 'いまやる一手は、bank と account type を1つに絞って口座開設条件ページを見ることです。';
  }

  if (domainIntent === 'school' && /(途中編入|編入|転校)/.test(messageText)) {
    return locationKnown
      ? '途中編入は一律の期限で決まるのではなく district と school の enrollment / registration 条件で決まるので、まず対象 district の受付スケジュールを確認するのが確実です。'
      : '途中編入は一律の期限で決まるのではなく district ごとの enrollment 条件で決まるので、まず住む予定の city / district を1つ仮置きして教育窓口の受付スケジュールを見るのが確実です。';
  }

  if (domainIntent === 'school') {
    return locationKnown
      ? '学校手続きは、対象校の条件確認 -> 必要書類と予防接種要件の確認 -> 登録日程の確定の順で見ると進めやすいです。'
      : '学校手続きは、住む予定の city / district を仮置きして確認先を決めるところから始めると進めやすいです。';
  }
  if (domainIntent === 'housing') return '住まい探しは、条件整理 -> 候補絞り込み -> 申込条件確認の順で進めると詰まりにくいです。';
  if (domainIntent === 'ssn') return 'SSN は、申請可否確認 -> 必要書類確認 -> office の予約要否確認の順で進めると止まりにくいです。';
  if (domainIntent === 'banking') return '口座開設は、bank と口座種別の決定 -> 必要書類確認 -> 支店か online 申請の順で進めると整理しやすいです。';
  return 'まずは優先する手続きを1件に絞って、期限・必要書類・予約要否の順で見ると進めやすいです。';
}

function resolveNextBestAction(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const domainIntent = normalizeProcedureDomain(payload.domainIntent);
  const locationKnown = payload.locationKnown === true;
  if (domainIntent === 'school') {
    return locationKnown
      ? '対象校か district を1つ決めて、enrollment / registration ページの「必要書類」と「受付スケジュール」を確認する'
      : '住む予定の city / district を1つ仮置きして、その教育窓口の enrollment / registration ページを開く';
  }
  if (domainIntent === 'housing') return 'must-have 条件を3つに絞り、候補物件を3件まで減らす';
  if (domainIntent === 'ssn') return '行く SSA office を1つ決めて、document requirements と予約要否を確認する';
  if (domainIntent === 'banking') return 'bank と口座種別を1つに絞って、account opening requirements を確認する';
  return '優先する手続きを1件に絞って、期限と確認先をメモする';
}

function resolveDecisionCriticalMissingFacts(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const domainSpec = resolveProcedureKnowledgeSpec(payload.domainIntent);
  const requestContract = payload.requestContract && typeof payload.requestContract === 'object'
    ? payload.requestContract
    : {};
  const locationHint = requestContract.locationHint && typeof requestContract.locationHint === 'object'
    ? requestContract.locationHint
    : {};
  const messageText = normalizeText(payload.messageText);
  const missing = [];

  if (!resolveLocationKnown(locationHint) && /学校|school|housing|住まい|ssn|銀行|banking/i.test(messageText)) {
    const cityLikeMissing = domainSpec.missingFacts[0];
    if (cityLikeMissing) missing.push(cityLikeMissing);
  }
  if (normalizeProcedureDomain(payload.domainIntent) === 'school' && !/学年|年齢|grade|kindergarten|elementary|middle|high/i.test(messageText)) {
    missing.push('子どもの学年または年齢');
  }
  if (normalizeProcedureDomain(payload.domainIntent) === 'housing' && !/家賃|予算|budget/i.test(messageText)) {
    missing.push('家賃レンジ');
  }
  if (normalizeProcedureDomain(payload.domainIntent) === 'ssn' && !/visa|在留|就労|work/i.test(messageText)) {
    missing.push('在留ステータスまたは就労状況');
  }
  if (normalizeProcedureDomain(payload.domainIntent) === 'banking' && !/bank|銀行|口座|checking|savings/i.test(messageText)) {
    missing.push('使いたい銀行または口座の用途');
  }
  return uniqueRawStrings(missing, 3);
}

function resolveKnowledgeReadiness(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const officialLikeCount = Number(payload.officialLikeCount || 0);
  const communityLikeCount = Number(payload.communityLikeCount || 0);
  const locationKnown = payload.locationKnown === true;
  const ruleReadiness = officialLikeCount > 0 ? 0.84 : (communityLikeCount > 0 ? 0.48 : 0.34);
  const procedureReadiness = (officialLikeCount + communityLikeCount) > 0 ? 0.82 : 0.56;
  const localPracticeReadiness = locationKnown
    ? ((officialLikeCount + communityLikeCount) > 0 ? 0.8 : 0.58)
    : (communityLikeCount > 0 ? 0.46 : 0.28);
  return {
    ruleReadiness: Number(ruleReadiness.toFixed(2)),
    procedureReadiness: Number(procedureReadiness.toFixed(2)),
    localPracticeReadiness: Number(localPracticeReadiness.toFixed(2))
  };
}

function countCandidatesBySource(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const faqCandidates = Array.isArray(payload.faqCandidates) ? payload.faqCandidates : [];
  const cityPackCandidates = Array.isArray(payload.cityPackCandidates) ? payload.cityPackCandidates : [];
  const sourceRefs = Array.isArray(payload.supportingSourceRefs) ? payload.supportingSourceRefs : [];
  let officialLikeCount = 0;
  let communityLikeCount = 0;
  sourceRefs.forEach((ref) => {
    const sourceType = normalizeText(ref && (ref.sourceType || ref.authority_tier || ref.authorityTier)).toLowerCase();
    if (sourceType.includes('official') || sourceType.startsWith('t1') || sourceType.startsWith('t0')) officialLikeCount += 1;
    else if (sourceType.includes('community') || sourceType.startsWith('t4')) communityLikeCount += 1;
  });
  if (cityPackCandidates.length > 0) officialLikeCount += 1;
  if (faqCandidates.length > 0) communityLikeCount += 1;
  return { officialLikeCount, communityLikeCount };
}

function resolveProcedureReplyPacket(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const domainIntent = normalizeProcedureDomain(payload.domainIntent || payload.contextResumeDomain);
  const domainSpec = resolveProcedureKnowledgeSpec(domainIntent);
  const requestContract = payload.requestContract && typeof payload.requestContract === 'object'
    ? payload.requestContract
    : {};
  const locationHint = requestContract.locationHint && typeof requestContract.locationHint === 'object'
    ? requestContract.locationHint
    : {};
  const locationKnown = resolveLocationKnown(locationHint);
  const knowledgeMode = resolveKnowledgeMode(payload.messageText, payload.followupIntent, domainSpec);
  const procedureComplexity = resolveProcedureComplexity(payload.messageText, payload.followupIntent, requestContract);
  const officialCheckTargets = resolveOfficialCheckTargets(domainSpec, locationKnown, knowledgeMode);
  const nextBestAction = resolveNextBestAction({ domainIntent, locationKnown });
  const decisionCriticalMissingFacts = resolveDecisionCriticalMissingFacts({
    domainIntent,
    requestContract,
    messageText: payload.messageText
  });
  const supportingSourceRefs = collectEvidenceRefs(payload);
  const rawSourceLayer = buildRawSourceLayer(supportingSourceRefs, domainIntent, locationHint);
  const procedureKnowledgeLayer = buildProcedureKnowledgeLayer(rawSourceLayer, domainSpec, {
    domainIntent,
    messageText: payload.messageText,
    locationHint
  });
  const counts = countCandidatesBySource(Object.assign({}, payload, { supportingSourceRefs }));
  const knowledgeReadiness = resolveKnowledgeReadiness({
    officialLikeCount: counts.officialLikeCount,
    communityLikeCount: counts.communityLikeCount,
    locationKnown
  });
  const packet = {
    domainIntent,
    replyObjective: 'answer_now',
    answerMode: knowledgeMode === 'rule_check' ? 'conditional_grounded_answer' : 'direct_action',
    procedureComplexity,
    knowledgeMode,
    locationKnown,
    relevanceAnchor: normalizeText(payload.messageText).slice(0, 120),
    fitRisk: decisionCriticalMissingFacts.length > 1 ? 'medium' : 'low',
    decisionCriticalMissingFacts,
    directAnswer: sanitizeSentence(resolveDirectAnswer({
      domainIntent,
      followupIntent: payload.followupIntent,
      locationKnown,
      messageText: payload.messageText
    })),
    overallFlow: uniqueStrings(domainSpec.overallFlow, 3),
    nextBestAction: sanitizeSentence(nextBestAction),
    keyPoints: uniqueStrings(domainSpec.keyPoints, 2),
    troublePoints: uniqueStrings(domainSpec.troublePoints, 2),
    goodToDo: uniqueStrings(domainSpec.goodToDo, 2),
    officialCheckTargets: uniqueStrings(officialCheckTargets, 3),
    warnings: uniqueStrings(domainSpec.troublePoints.slice(0, 1), 1),
    quickReplies: Array.isArray(domainSpec.quickReplies) ? domainSpec.quickReplies.slice(0, 3) : [],
    evidenceRefs: supportingSourceRefs,
    supportingSourceRefs: supportingSourceRefs.map((ref) => ref.source_snapshot_id || ref.ref_id || ref.label).filter(Boolean).slice(0, 6),
    rawSourceLayer,
    procedureKnowledgeLayer,
    rawSourceReview: buildRawSourceReview(rawSourceLayer),
    procedureKnowledgeReview: buildProcedureKnowledgeReview(procedureKnowledgeLayer),
    confidenceBasis: knowledgeMode === 'rule_check'
      ? 'official confirmation target required'
      : 'procedure guidance synthesized from domain knowledge and available sources',
    knowledgeReadiness
  };
  packet.replyObjective = resolveReplyObjective(knowledgeMode, requestContract, packet);
  return packet;
}

function renderProcedureReplyPacket(packet, options) {
  const payload = packet && typeof packet === 'object' ? packet : {};
  const config = options && typeof options === 'object' ? options : {};
  const outputForm = normalizeText(config.outputForm).toLowerCase();
  const mode = normalizeText(config.mode).toLowerCase() || 'default';
  const lines = [];

  if (outputForm === 'one_line') {
    return sanitizeSentence(payload.directAnswer || payload.nextBestAction || 'まずは次の一手を1つ決めると進めやすいです。');
  }
  if (outputForm === 'two_sentences') {
    return [
      sanitizeSentence(payload.directAnswer),
      sanitizeSentence(`いまやる一手は、${normalizeText(payload.nextBestAction).replace(/[。！？!?]+$/g, '')}です`)
    ].filter(Boolean).slice(0, 2).join('\n');
  }

  if (mode === 'followup' || payload.procedureComplexity === 'compressed') {
    lines.push(sanitizeSentence(payload.directAnswer));
    if (payload.nextBestAction) {
      lines.push(sanitizeSentence(`いまやる一手は、${normalizeText(payload.nextBestAction).replace(/[。！？!?]+$/g, '')}です`));
    }
    if (payload.officialCheckTargets && payload.officialCheckTargets.length > 0) {
      lines.push(sanitizeSentence(`確認先は、${payload.officialCheckTargets[0].replace(/[。！？!?]+$/g, '')}です`));
    }
    return lines.filter(Boolean).slice(0, 3).join('\n');
  }

  lines.push(sanitizeSentence(payload.directAnswer));
  lines.push(sanitizeSentence(`全体工程は、${(Array.isArray(payload.overallFlow) ? payload.overallFlow : []).map((line) => normalizeText(line).replace(/[。！？!?]+$/g, '')).filter(Boolean).join(' -> ')}です`));
  lines.push(sanitizeSentence(`いまやる一手は、${normalizeText(payload.nextBestAction).replace(/[。！？!?]+$/g, '')}です`));
  if (Array.isArray(payload.keyPoints) && payload.keyPoints[0]) {
    lines.push(sanitizeSentence(`ポイントは、${normalizeText(payload.keyPoints[0]).replace(/[。！？!?]+$/g, '')}ことです`));
  }
  if (Array.isArray(payload.troublePoints) && payload.troublePoints[0]) {
    lines.push(sanitizeSentence(`詰まりどころは、${normalizeText(payload.troublePoints[0]).replace(/[。！？!?]+$/g, '')}ことです`));
  }
  if (Array.isArray(payload.goodToDo) && payload.goodToDo[0]) {
    lines.push(sanitizeSentence(`やっておくと良いことは、${normalizeText(payload.goodToDo[0]).replace(/[。！？!?]+$/g, '')}ことです`));
  }
  if (Array.isArray(payload.officialCheckTargets) && payload.officialCheckTargets[0]) {
    lines.push(sanitizeSentence(`確認先は、${normalizeText(payload.officialCheckTargets[0]).replace(/[。！？!?]+$/g, '')}です`));
  }
  return lines.filter(Boolean).slice(0, 6).join('\n');
}

function buildProcedureSemanticFields(packet, options) {
  const payload = packet && typeof packet === 'object' ? packet : {};
  const config = options && typeof options === 'object' ? options : {};
  const tasks = [];
  if (payload.nextBestAction) {
    tasks.push({
      title: normalizeText(payload.nextBestAction).replace(/[。！？!?]+$/g, ''),
      priority: 'high',
      status: 'suggested',
      blockers: Array.isArray(payload.troublePoints) ? payload.troublePoints.slice(0, 1) : []
    });
  }
  (Array.isArray(payload.goodToDo) ? payload.goodToDo : []).slice(0, 1).forEach((line) => {
    tasks.push({
      title: normalizeText(line).replace(/[。！？!?]+$/g, ''),
      priority: 'medium',
      status: 'suggested',
      blockers: []
    });
  });
  return {
    nextSteps: []
      .concat(payload.nextBestAction ? [normalizeText(payload.nextBestAction).replace(/[。！？!?]+$/g, '')] : [])
      .concat(Array.isArray(payload.goodToDo) ? payload.goodToDo.map((line) => normalizeText(line).replace(/[。！？!?]+$/g, '')).slice(0, 1) : []),
    warnings: Array.isArray(payload.troublePoints)
      ? payload.troublePoints.map((line) => normalizeText(line).replace(/[。！？!?]+$/g, '')).slice(0, 1)
      : [],
    tasks: tasks.slice(0, 2),
    quickReplies: Array.isArray(payload.quickReplies) ? payload.quickReplies.slice(0, config.maxQuickReplies || 3) : [],
    evidenceRefs: Array.isArray(payload.evidenceRefs) ? payload.evidenceRefs.slice(0, 4) : [],
    officialCheckTargets: Array.isArray(payload.officialCheckTargets) ? payload.officialCheckTargets.slice(0, 2) : []
  };
}

module.exports = {
  resolveProcedureReplyPacket,
  renderProcedureReplyPacket,
  buildProcedureSemanticFields
};
