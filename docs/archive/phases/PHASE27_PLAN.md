# PHASE27_PLAN

## Phase27の目的
Phase26で追加した ops-console list を運用入口として“迷いなく使える”状態に固定する。
具体的には、一覧の並び順・必須キー・互換性（nextPageToken / pageInfo）をSSOTとして docs + tests で確定する。

## Scope In
- ops-console list の並び順（READY優先 + 安定ソート）を仕様として固定
- list の required keys / type をガード（欠落時のデフォルト規約を固定）
- pagination placeholder の互換性テスト強化（nextPageToken維持 + pageInfo固定）
- docs: PHASE27_PLAN / PHASE27_EXECUTION_LOG をSSOTとして追加

## Scope Out
- 本物のページング実装（cursor を受けて次ページ取得する処理）
- フィルタ条件の追加（region/scenario など）
- パフォーマンス最適化（並列化/キャッシュ）
- UI追加/改修

## Top5（優先度順）
| Priority | 作業候補 | なぜ今やるのか | 何をやらない代わりか |
| --- | --- | --- | --- |
| 1 | list のソート規約をSSOT化（READY優先 + 安定キー） | opsが“何から見るか”で迷わない一本道にするため | 新しいフィルタ追加はしない |
| 2 | list の required keys guard（欠落時デフォルト） | 欠落/例外で運用が止まらないようにするため | 本質データ修復はしない |
| 3 | pagination placeholder 互換性テスト強化 | Phase26互換（nextPageToken/pageInfo）を壊さないため | 本物のページングはしない |
| 4 | docs: PLAN/EXECUTION_LOG SSOT追加 | “仕様→実装→証跡”を一本道で固定するため | 既存Phase docsの改変はしない |
| 5 | list の contract テスト追加（items空でも安定） | 運用入口の最低保証を固定するため | UI側の回避実装はしない |

## ソート/ガード仕様（SSOT）
- 対象: GET /api/phase26/ops-console/list
- items の並び順:
  - readiness.status が READY のものを先に並べる
  - 同一status内は cursorCandidate の降順（新しいものが先）
    - cursorCandidate = opsState.updatedAt || latestDecisionLog.decidedAt || latestDecisionLog.createdAt || null
  - それでも同値の場合は lineUserId の昇順で安定化
- required keys（各 item）:
  - lineUserId: string
  - readiness: { status: 'READY'|'NOT_READY', blocking: string[] }
  - recommendedNextAction: string
  - allowedNextActions: string[]
  - opsState: object|null
  - latestDecisionLog: object|null

## CLOSE条件（全てYESでCLOSE）
- PLAN exists: YES
- Top tasks implemented: YES
- tests added: YES
- npm test PASS: YES
- main CI PASS: YES
- docs append-only: YES

## 既存Phaseとの非改変宣言
- Phase26: nextPageToken / pageInfo の互換は壊さない（キー維持・意味変更なし）
- Phase25/24: readiness/consistency/decision log の意味変更はしない
- Phase23: Runbook/CI/判定ロジックは変更しない
