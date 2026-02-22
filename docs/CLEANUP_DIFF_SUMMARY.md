# CLEANUP_DIFF_SUMMARY

| item | before | after | note |
| --- | --- | --- | --- |
| canonical repos | 22 | 22 | 変更なし |
| legacy repos | 6 | 6 | DEPRECATED/LEGACY_HEADER強化 |
| duplicate groups | 6 | 6 | 削除なし、可視化のみ |
| missing-index fallback points | 20 | 20 | 設計固定のみ |
| full-scan hotspots | 0 | 0 | 優先順位固定のみ |
| lifecycle rows | 44 | 45 | retentionPolicy準拠へ再生成 |
| unreachable frozen files | 0 markers | 20 | LEGACY_FROZEN_DO_NOT_USE を付与 |

## 備考
- 本フェーズは構造文書化と凍結のみ。実行経路置換は次PR。
