'use strict';

function statusDeclared(last4) {
  return `会員IDは登録済みです（末尾: ${last4}）。変更する場合は「会員ID 00-0000」を送信してください。`;
}

function statusUnlinked() {
  return '会員IDは解除済みです。再登録する場合は「会員ID 00-0000」を送信してください。';
}

function statusNotDeclared() {
  return '会員IDは未登録です。登録する場合は「会員ID 00-0000」を送信してください。';
}

function declareLinked() {
  return '会員IDの登録が完了しました。「会員ID 確認」で登録状態を確認できます。';
}

function declareDuplicate() {
  return 'その会員IDはすでに登録があります。番号を再確認し、必要なら運用担当へご連絡ください。';
}

function declareInvalidFormat() {
  return '会員IDの形式が正しくありません。例: 会員ID 00-0000';
}

function declareUsage() {
  return '会員IDの使い方: 「会員ID 00-0000」で登録し、「会員ID 確認」で状態を確認できます。';
}

function declareServerMisconfigured() {
  return '現在この操作は利用できません。時間をおいて再度お試しください。';
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
