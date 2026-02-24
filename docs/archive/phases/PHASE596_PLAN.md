# Phase596 計画

## 目的
- `productReadiness` を `snapshot_stale_ratio_max` と `fallback_spike_max` を
  `READ_PATH_BUDGETS.md` の末尾基準値から読み取り、環境変数で上書き可能に統一する。
- `read-path` 健全性チェックのしきい値をハードコードから予算駆動へ移行し、merge drift を減らす。

## 非対象
- `/api/admin/os/alerts/summary` や CI スクリプト本体の再設計は対象外。
- 新規 read-path ゲート閾値の値決定は次フェーズ。

## 実装範囲
- `src/routes/admin/productReadiness.js`（閾値解決ロジック）
- `docs/READ_PATH_BUDGETS.md`（`current_baseline_phase596` 追加）
- `tests/phase596`（契約テスト追加）
- `docs/SSOT_INDEX.md`（参照追加）

## 受け入れ条件
- `snapshot_stale_ratio_max` / `fallback_spike_max` が `READ_PATH_BUDGETS.md` 末尾基準から解決される。
- `productReadiness` の response に `snapshotHealth.staleRatioThreshold` と `fallbackSpikes.threshold` が返る。
- `npm run test:docs` / `npm test` が pass。
