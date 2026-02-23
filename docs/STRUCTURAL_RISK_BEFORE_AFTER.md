# STRUCTURAL_RISK_BEFORE_AFTER

| risk | before | after | mitigation |
| --- | --- | --- | --- |
| duplicate実装の分岐 | high | medium | LEGACY_HEADER + canonical alias明示 |
| missing-index fallback依存 | high | medium | INDEX_PLAN + CI監視 |
| full-scan常用 | high | medium | FULL_SCAN_BOUNDING_PLANで移行順固定 |
| scenario命名ドリフト | high | medium | NAMING_DRIFT_SCENARIOKEY_PLANでmapper統一 |
| retention定義不鮮明 | high | medium | SSOT_RETENTION_ADDENDUM (45件未定義を明示) |

## 注記
- duplicate groups: 6
- fallback points: 18
