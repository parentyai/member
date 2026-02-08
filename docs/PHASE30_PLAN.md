# PHASE30_PLAN

## 対象フェーズ
- Phase30

## Phase30の目的
ops-console list の pagination 運用を、UI側が迷わず扱える情報付きでSSOT化する。
既存互換（レスポンスキー/意味）を壊さず、cursor署名の運用状態を明確化する。

## Scope In
- listレスポンスに cursor運用情報を追加（`pageInfo.cursorInfo`）
- cursorInfo の内容を tests で固定（SIGNED/UNSIGNED, enforce）
- docs: PHASE30_PLAN / PHASE30_EXECUTION_LOG を追加

## Scope Out
- LINEアプリ案（永久にOut）
- 既存APIキーの削除/意味変更
- cursor署名の強制（デフォルトでのreject）
- UI実装
- コスト最適化

## Tasks
- T01: `pageInfo.cursorInfo` の追加（mode/enforce）
- T02: cursorInfo のテスト追加（secretなし/あり/enforce）
- T03: docs追記（PLAN/EXECUTION_LOG）

## Done定義（全てYESでCLOSE）
- PLAN exists: YES
- T01-T02 implemented: YES
- tests added: YES
- npm test PASS: YES
- main CI PASS: YES
- docs append-only: YES

## Rollback
- revert PR
