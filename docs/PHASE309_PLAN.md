# PHASE309_PLAN

## 目的
Phase Next P1-P5 の運用補強を add-only で導入し、既存挙動を壊さずに運用導線・監査・性能・Retention運用を定着させる。

## スコープ
- P1: Struct Drift Backfill の運用可視化（admin runs + resume）
- P2: legacy `/admin/review` の LEGACY 明示
- P3: trace bundle query の index前提化
- P4: Ops snapshot read-model 追加（snapshot優先 + fallback保持）
- P5: retention apply（stg限定 / feature flag / policy制約）

## 非スコープ
- 既存エンドポイントの破壊変更
- Firestore schema の既存フィールド意味変更
- 本番削除ジョブ

## 受け入れ条件
- `npm run test:docs` / `npm test` が通る
- 新規 route は既存保護ポリシーを維持
- 監査ログに traceId と実行要約が残る
