# PHASE129_131_PLAN

## Purpose
Ops の「閲覧→判断→（実行/未実行）」を後から完全に再現できるように、監査ログ（audit_logs）と意思決定ログ（decision_logs）の一貫性を固定し、Ops Console 詳細画面を迷わない表示にする。

## Scope In
### Phase129: Ops Console view の監査
- Ops Console の閲覧を `audit_logs` に best-effort 記録
  - action: `ops_console.view`
  - payloadSummary: `{ lineUserId, readinessStatus }`
- view→submit の紐付け用 `traceId` を console response に add-only で付与し、decision_logs / audit_logs に同一 `traceId` を記録する

### Phase130: 「見送り」も判断として固定
- `NO_ACTION` / `STOP_AND_ESCALATE` も decision として必ず `decision_logs` に記録する（既存互換維持）
- decision snapshot（audit）に以下を add-only で必須保存:
  - `readiness.status`（`readinessStatus`）
  - `allowedNextActions`
  - `recommendedNextAction`
  - `decidedNextAction`
- automation/batch は `NO_ACTION` を実行しない（skip）

### Phase131: Ops Console「迷わない画面」固定
- Ops Console response に add-only で display 向け keys 追加（例: `blockingReasons`, `lastReactionAt`, `latestDecisionSummary`, `executionMessage`, `dangerFlags`）
- UI は受け取った情報をそのまま表示（判断ロジックは追加しない）
- 危険状態（NOT_READY / stale）は視覚的に明示

## Scope Out
- LINE-only の新しい反応取得ロジック追加
- 既存APIレスポンスの意味変更（add-only のみ）
- LLM 実行/自動運用の導入

## Done Definition
- view / submit / execute（未実行含む）が audit_logs / decision_logs で追跡できる
- Ops Console 詳細で「危険/見送り/実行済み」が即わかる
- `npm test` PASS

## Rollback
- revert 実装PR

