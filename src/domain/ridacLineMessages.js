'use strict';

function withNextAction(summary, nextAction) {
  return `${summary} 次にすること: ${nextAction}`;
}

function statusDeclared(last4) {
  return withNextAction(
    `会員IDは登録済みです（末尾: ${last4}）。`,
    '内容が違う場合は「会員ID 00-0000」を送信してください。'
  );
}

function statusUnlinked() {
  return withNextAction(
    '会員IDは解除済みです。',
    '再登録する場合は「会員ID 00-0000」を送信してください。'
  );
}

function statusNotDeclared() {
  return withNextAction(
    '会員IDは未登録です。',
    '登録する場合は「会員ID 00-0000」を送信してください。'
  );
}

function declareLinked() {
  return withNextAction(
    '会員IDの登録が完了しました。',
    '「会員ID 確認」で登録状態を確認してください。'
  );
}

function declareDuplicate() {
  return withNextAction(
    'その会員IDはすでに登録があります。',
    '番号を再確認し、必要なら運用担当へご連絡ください。'
  );
}

function declareInvalidFormat() {
  return withNextAction(
    '会員IDの形式が正しくありません。',
    '例「会員ID 00-0000」の形式で送信してください。'
  );
}

function declareUsage() {
  return withNextAction(
    '会員IDの使い方です。',
    '「会員ID 00-0000」で登録し、「会員ID 確認」で状態を確認してください。'
  );
}

function declareServerMisconfigured() {
  return withNextAction(
    '現在この操作は利用できません。',
    '時間をおいて再度お試しください。'
  );
}

module.exports = {
  statusDeclared,
  statusUnlinked,
  statusNotDeclared,
  declareLinked,
  declareDuplicate,
  declareInvalidFormat,
  declareUsage,
  declareServerMisconfigured
};
