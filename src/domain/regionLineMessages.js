'use strict';

function regionPrompt() {
  return '地域（City, State）を入力してください。例: Austin, TX';
}

function regionDeclared(city, state) {
  const cityLabel = city || '-';
  const stateLabel = state || '-';
  return `地域を登録しました: ${cityLabel}, ${stateLabel}`;
}

function regionInvalid() {
  return '地域の形式が読み取れませんでした。例: Austin, TX の形式で入力してください。';
}

function regionAlreadySet() {
  return '地域は既に登録済みです。変更が必要な場合は管理者へご連絡ください。';
}

module.exports = {
  regionPrompt,
  regionDeclared,
  regionInvalid,
  regionAlreadySet
};
